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

app.listen(3001, () => {
  console.log("User Service running on port 3001");
});