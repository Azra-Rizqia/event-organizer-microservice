import os
import sqlite3
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

PORT = int(os.getenv("PORT", 5000))
DB_PATH = os.getenv("DB_PATH", "/app/data/transaksi.db")
TIKET_SERVICE_URL = os.getenv("TIKET_SERVICE_URL", "http://tiket-service:3002")

# DB
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transaksi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tiket_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            jumlah_bayar REAL NOT NULL,
            metode_pembayaran TEXT NOT NULL DEFAULT 'transfer',
            status TEXT NOT NULL DEFAULT 'pending',
            -- Snapshot dari tiket saat transaksi dibuat
            tiket_snapshot TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("Transaksi Service: database SQLite siap")

# HELPERS 
def fetch_tiket(tiket_id):
    res = requests.get(f"{TIKET_SERVICE_URL}/tikets/{tiket_id}", timeout=5)
    if res.status_code != 200:
        raise Exception(f"Tiket dengan id {tiket_id} tidak ditemukan")
    return res.json().get("data")

def row_to_dict(row):
    import json
    d = dict(row)
    # Parse tiket_snapshot dari JSON
    if d.get("tiket_snapshot"):
        try:
            d["tiket_snapshot"] = json.loads(d["tiket_snapshot"])
        except Exception:
            pass
    return d

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "service": "transaksi-service",
        "language": "Python",
        "framework": "Flask",
        "database": "sqlite",
        "status": "running"
    })

# GET all
@app.route("/transaksi", methods=["GET"])
def get_all():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transaksi ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify({
        "service": "transaksi-service",
        "data": [row_to_dict(r) for r in rows]
    })

# GET by ID
@app.route("/transaksi/<int:transaksi_id>", methods=["GET"])
def get_one(transaksi_id):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM transaksi WHERE id = ?", (transaksi_id,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"message": "Transaksi tidak ditemukan"}), 404
    return jsonify({"service": "transaksi-service", "data": row_to_dict(row)})

# GET by user_id
@app.route("/transaksi/user/<int:user_id>", methods=["GET"])
def get_by_user(user_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transaksi WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return jsonify({
        "service": "transaksi-service",
        "data": [row_to_dict(r) for r in rows]
    })

@app.route("/transaksi", methods=["POST"])
def create():
    import json
    body = request.get_json()
    tiket_id = body.get("tiket_id")
    metode_pembayaran = body.get("metode_pembayaran", "transfer")

    if not tiket_id:
        return jsonify({"message": "tiket_id wajib diisi"}), 400

    metode_valid = ["transfer", "cash", "e-wallet", "kartu_kredit"]
    if metode_pembayaran not in metode_valid:
        return jsonify({
            "message": "Metode pembayaran tidak valid",
            "metode_valid": metode_valid
        }), 400

    # Ambil data tiket dari tiket-service
    try:
        tiket = fetch_tiket(tiket_id)
    except Exception as e:
        return jsonify({"message": str(e)}), 404

    # Validasi tiket status
    if tiket.get("status") == "cancelled":
        return jsonify({"message": "Tiket sudah dibatalkan, tidak bisa dibayar"}), 400

    if tiket.get("status") == "confirmed":
        return jsonify({"message": "Tiket sudah dibayar sebelumnya"}), 400

    jumlah_bayar = tiket.get("total_harga", 0)
    user_id = tiket.get("user_id")
    event_id = tiket.get("event_id")

    tiket_snapshot = json.dumps({
        "tiket_id": tiket_id,
        "user_snapshot": tiket.get("user_snapshot"),
        "event_snapshot": tiket.get("event_snapshot"),
        "quantity": tiket.get("quantity"),
        "harga_per_tiket": tiket.get("harga_per_tiket"),
        "total_harga": jumlah_bayar
    })

    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO transaksi (tiket_id, user_id, event_id, jumlah_bayar, metode_pembayaran, status, tiket_snapshot)
        VALUES (?, ?, ?, ?, ?, 'success', ?)
    """, (tiket_id, user_id, event_id, jumlah_bayar, metode_pembayaran, tiket_snapshot))
    conn.commit()
    new_id = cursor.lastrowid

    # Update status tiket menjadi confirmed di tiket-service
    try:
        requests.patch(
            f"{TIKET_SERVICE_URL}/tikets/{tiket_id}/status",
            json={"status": "confirmed"},
            timeout=5
        )
    except Exception as e:
        print(f"Warning: gagal update status tiket: {e}")

    row = conn.execute(
        "SELECT * FROM transaksi WHERE id = ?", (new_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        "service": "transaksi-service",
        "message": "Transaksi berhasil dibuat",
        "data": row_to_dict(row)
    }), 201

# PUT update transaksi
@app.route("/transaksi/<int:transaksi_id>", methods=["PUT"])
def update(transaksi_id):
    body = request.get_json()
    tiket_id = body.get("tiket_id")
    metode_pembayaran = body.get("metode_pembayaran")
    status = body.get("status")

    if not tiket_id or not metode_pembayaran or not status:
        return jsonify({
            "message": "tiket_id, metode_pembayaran, dan status wajib diisi"
        }), 400

    metode_valid = ["transfer", "cash", "e-wallet", "kartu_kredit"]
    if metode_pembayaran not in metode_valid:
        return jsonify({
            "message": "Metode pembayaran tidak valid",
            "metode_valid": metode_valid
        }), 400

    allowed = ["pending", "success", "failed", "refunded"]
    if status not in allowed:
        return jsonify({
            "message": "Status tidak valid",
            "allowed_status": allowed
        }), 400

    conn = get_db()
    row = conn.execute(
        "SELECT * FROM transaksi WHERE id = ?", (transaksi_id,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"message": "Transaksi tidak ditemukan"}), 404

    conn.execute("""
        UPDATE transaksi
        SET tiket_id = ?, metode_pembayaran = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (tiket_id, metode_pembayaran, status, transaksi_id))
    conn.commit()

    row = conn.execute(
        "SELECT * FROM transaksi WHERE id = ?", (transaksi_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        "service": "transaksi-service",
        "message": "Transaksi berhasil diperbarui",
        "data": row_to_dict(row)
    })

# PATCH update status transaksi
@app.route("/transaksi/<int:transaksi_id>/status", methods=["PATCH"])
def update_status(transaksi_id):
    body = request.get_json()
    status = body.get("status")
    allowed = ["pending", "success", "failed", "refunded"]
    if not status or status not in allowed:
        return jsonify({
            "message": "Status tidak valid",
            "allowed_status": allowed
        }), 400

    conn = get_db()
    conn.execute(
        "UPDATE transaksi SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, transaksi_id)
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM transaksi WHERE id = ?", (transaksi_id,)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"message": "Transaksi tidak ditemukan"}), 404

    return jsonify({
        "service": "transaksi-service",
        "message": "Status transaksi diperbarui",
        "data": row_to_dict(row)
    })

# DELETE transaksi
@app.route("/transaksi/<int:transaksi_id>", methods=["DELETE"])
def delete(transaksi_id):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM transaksi WHERE id = ?", (transaksi_id,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"message": "Transaksi tidak ditemukan"}), 404
    conn.execute("DELETE FROM transaksi WHERE id = ?", (transaksi_id,))
    conn.commit()
    conn.close()
    return jsonify({"service": "transaksi-service", "message": "Transaksi berhasil dihapus"})

# START 
if __name__ == "__main__":
    init_database()
    app.run(host="0.0.0.0", port=PORT)