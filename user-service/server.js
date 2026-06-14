const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: "postgres-user",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "userdb"
});

async function connectWithRetry(retries = 20, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("User Service berhasil terhubung ke PostgreSQL");
      return;
    } catch (error) {
      console.log(`Menunggu PostgreSQL siap... percobaan ${attempt}`);
      console.log(error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("User Service gagal terhubung ke PostgreSQL");
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'customer'
    )
  `);

  const result = await pool.query("SELECT COUNT(*) AS total FROM users");
  const total = parseInt(result.rows[0].total, 10);

  if (total === 0) {
    await pool.query(`
      INSERT INTO users (name, email, role) VALUES
        ('Andi', 'andi@example.com', 'customer'),
        ('Budi', 'budi@example.com', 'customer'),
        ('Admin', 'admin@example.com', 'admin')
    `);
    console.log("User Service: data awal users berhasil dibuat");
  }
}

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({
    service: "user-service",
    database: "postgresql",
    status: "running"
  });
});

// GET ALL USERS
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users ORDER BY id"
    );

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET USER BY ID
app.get("/users/:id", async (req, res) => {
  try {

    const result = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST USER
app.post("/users", async (req, res) => {

  const { name, email, role } = req.body;

  try {

    const result = await pool.query(
      `INSERT INTO users(name,email,role)
       VALUES($1,$2,$3)
       RETURNING *`,
      [name, email, role]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT USER
app.put("/users/:id", async (req, res) => {

  const { name, email, role } = req.body;

  try {

    const result = await pool.query(
      `UPDATE users
       SET name=$1,email=$2,role=$3
       WHERE id=$4
       RETURNING *`,
      [name, email, role, req.params.id]
    );

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH USER
app.patch("/users/:id", async (req, res) => {

  try {

    const current = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [req.params.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const user = current.rows[0];

    const result = await pool.query(
      `UPDATE users
       SET name=$1,email=$2,role=$3
       WHERE id=$4
       RETURNING *`,
      [
        req.body.name || user.name,
        req.body.email || user.email,
        req.body.role || user.role,
        req.params.id
      ]
    );

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE USER
app.delete("/users/:id", async (req, res) => {

  try {

    await pool.query(
      "DELETE FROM users WHERE id=$1",
      [req.params.id]
    );

    res.json({
      message: "User deleted"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  await connectWithRetry();
  await initDatabase();
  app.listen(3001, () => {
    console.log("User Service running on port 3001");
  });
}

startServer();