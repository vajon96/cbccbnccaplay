import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("bncc_enrollment.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS applicants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    motherName TEXT NOT NULL,
    dob TEXT NOT NULL,
    gender TEXT NOT NULL,
    bloodGroup TEXT NOT NULL,
    collegeId TEXT NOT NULL,
    class TEXT NOT NULL,
    roll TEXT NOT NULL,
    session TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    photo TEXT, -- Base64 encoded photo
    status TEXT DEFAULT 'Pending',
    attendanceStatus TEXT DEFAULT 'Absent',
    attendanceTime DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration for existing databases
try {
  db.prepare("ALTER TABLE applicants ADD COLUMN attendanceStatus TEXT DEFAULT 'Absent'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE applicants ADD COLUMN attendanceTime DATETIME").run();
} catch (e) {}

// Set default admin password if not exists
const adminPass = db.prepare("SELECT value FROM admin_config WHERE key = 'admin_password'").get();
if (!adminPass) {
  db.prepare("INSERT INTO admin_config (key, value) VALUES (?, ?)").run("admin_password", "bncc1234");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/apply", (req, res) => {
    try {
      const {
        fullName, fatherName, motherName, dob, gender, bloodGroup,
        collegeId, class: className, roll, session, mobile, email, photo
      } = req.body;

      const stmt = db.prepare(`
        INSERT INTO applicants (
          fullName, fatherName, motherName, dob, gender, bloodGroup,
          collegeId, class, roll, session, mobile, email, photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        fullName, fatherName, motherName, dob, gender, bloodGroup,
        collegeId, className, roll, session, mobile || null, email || null, photo
      );

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to submit enrollment" });
    }
  });

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const adminPass = db.prepare("SELECT value FROM admin_config WHERE key = 'admin_password'").get();
    if (password === adminPass.value) {
      res.json({ success: true, token: "mock-admin-token" });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  app.get("/api/admin/applicants", (req, res) => {
    try {
      const applicants = db.prepare("SELECT * FROM applicants ORDER BY createdAt DESC").all();
      res.json(applicants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applicants" });
    }
  });

  app.patch("/api/admin/applicants/:id", (req, res) => {
    const { id } = req.params;
    const { status, attendanceStatus } = req.body;
    try {
      if (status !== undefined) {
        db.prepare("UPDATE applicants SET status = ? WHERE id = ?").run(status, id);
      }
      if (attendanceStatus !== undefined) {
        const attendanceTime = attendanceStatus === 'Present' ? new Date().toISOString() : null;
        db.prepare("UPDATE applicants SET attendanceStatus = ?, attendanceTime = ? WHERE id = ?").run(attendanceStatus, attendanceTime, id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update applicant" });
    }
  });

  app.post("/api/admin/mark-attendance", (req, res) => {
    const { id } = req.body;
    try {
      const applicant = db.prepare("SELECT * FROM applicants WHERE id = ?").get(id);
      if (!applicant) {
        return res.status(404).json({ error: "Applicant not found" });
      }
      
      const attendanceTime = new Date().toISOString();
      db.prepare("UPDATE applicants SET attendanceStatus = 'Present', attendanceTime = ? WHERE id = ?").run(attendanceTime, id);
      
      const updatedApplicant = db.prepare("SELECT * FROM applicants WHERE id = ?").get(id);
      res.json({ success: true, applicant: updatedApplicant });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark attendance" });
    }
  });

  app.delete("/api/admin/applicants/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM applicants WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete applicant" });
    }
  });

  app.get("/api/applicant/:id", (req, res) => {
    const { id } = req.params;
    try {
      const applicant = db.prepare("SELECT * FROM applicants WHERE id = ?").get(id);
      if (applicant) {
        res.json(applicant);
      } else {
        res.status(404).json({ error: "Applicant not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applicant" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
