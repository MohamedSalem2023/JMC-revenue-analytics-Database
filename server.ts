import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
// تقليل الحد قليلاً لضمان استقرار السيرفر
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

let uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is missing!");
  process.exit(1);
}

// تنظيف الرابط
uri = uri.replace(/<|>/g, "");

let client: MongoClient | null = null;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri as string, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 10, // تحديد عدد الاتصالات لتوفير الذاكرة
    });
    await client.connect();
  }
  return client.db("JMSRevenueAnalysis");
}

// API جلب البيانات - نسخة "خفيفة الوزن"
app.get("/api/data", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    console.log("Fetching data...");
    
    // جلب البيانات فقط، بدون ترتيب معقد في البداية
    const cursor = collection.find({});
    const allData: any[] = [];
    
    await cursor.forEach((chunk: any) => {
      try {
        const parsed = typeof chunk.data === 'string' ? JSON.parse(chunk.data) : chunk.data;
        if (Array.isArray(parsed)) {
          allData.push(...parsed);
        }
      } catch (e) {
        console.error("Parse error in chunk");
      }
    });

    console.log(`Total rows reassembled: ${allData.length}`);
    res.json({ data: allData.length > 0 ? allData : null });
  } catch (error: any) {
    console.error("Fetch error:", error.message);
    res.status(500).json({ error: "Database connection failed. Please try again." });
  }
});

// API رفع البيانات - مع تنظيف تلقائي
app.post("/api/data/upload-chunk", async (req, res) => {
  try {
    const { chunk, index } = req.body;
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    // إذا كان هذا هو الجزء الأول، نمسح كل القديم فوراً لتوفير مساحة
    if (index === 0) {
      await collection.deleteMany({});
    }

    await collection.insertOne({ 
      index, 
      data: JSON.stringify(chunk), 
      timestamp: new Date() 
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/data/clear", async (req, res) => {
  try {
    const database = await getDb();
    await database.collection("revenue_chunks").deleteMany({});
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  try {
    await getDb();
    console.log("Connected to MongoDB");
  } catch (e) {
    console.error("Initial connection failed");
  }

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server ready on port ${PORT}`);
  });
}

startServer();