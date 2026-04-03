import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json({ limit: '500mb' })); // Increase limit for large JSON payloads
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// We will use the environment variable directly
let uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI environment variable is not set.");
  process.exit(1);
}

// Fix common mistake where users leave < and > around the password in the connection string
if (uri.includes("<") || uri.includes(">")) {
  console.log("Cleaning MONGODB_URI: removing < and > symbols.");
  uri = uri.replace(/<|>/g, "");
}

let client: MongoClient;
let db: any;

async function getDb() {
  if (db) return db;
  
  const connectionUri = (uri as string).trim();
  let lastError;
  
  for (let i = 0; i < 5; i++) {
    try {
      const maskedUri = connectionUri.replace(/:([^@]+)@/, ":****@");
      console.log(`[Attempt ${i + 1}/5] Connecting to MongoDB: ${maskedUri}`);
      
      client = new MongoClient(connectionUri, {
        connectTimeoutMS: 45000,
        serverSelectionTimeoutMS: 45000,
        socketTimeoutMS: 60000,
        retryWrites: true,
        retryReads: true,
      });
      
      await client.connect();
      
      // Verify connection with a ping
      await client.db("admin").command({ ping: 1 });
      
      console.log("Successfully connected and pinged MongoDB!");
      db = client.db("JMSRevenueAnalysis");
      return db;
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed: ${error.message}`);
      
      // Close client if it was created but failed to connect/ping
      if (client) {
        await client.close().catch(() => {});
      }

      if (i < 4) {
        const delay = (i + 1) * 5000;
        console.log(`Retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error("All 5 MongoDB connection attempts failed.");
  throw lastError;
}

async function connectToMongo() {
  try {
    await getDb();
  } catch (error) {
    console.error("Error connecting to MongoDB on startup:", error);
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/data", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    // Ensure index exists to avoid blocking sort
    try {
      await collection.createIndex({ index: 1 });
    } catch (indexError) {
      console.warn("Could not create index on 'index' field:", indexError);
    }
    
    console.log("Fetching data from MongoDB...");
    // Use .allowDiskUse() on the cursor to prevent memory limit errors when sorting large datasets
    const cursor = collection.find({}).sort({ index: 1 }).allowDiskUse();
    const chunks = await cursor.toArray();
    
    console.log(`Found ${chunks.length} chunks in database.`);

    if (chunks.length === 0) {
      console.log("No data found in revenue_chunks collection.");
      return res.json({ data: null });
    }

    // Reassemble chunks
    const allData = chunks.reduce((acc: any[], chunk: any) => {
      try {
        const parsed = typeof chunk.data === 'string' ? JSON.parse(chunk.data) : chunk.data;
        return acc.concat(parsed);
      } catch (e) {
        console.error("Error parsing chunk data at index", chunk.index, ":", e);
        return acc;
      }
    }, []);

    console.log(`Successfully reassembled ${allData.length} rows.`);
    
    res.json({ data: allData });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: error.message || "Failed to fetch data" });
  }
});

app.post("/api/data/upload-chunk", async (req, res) => {
  try {
    const { chunk, index } = req.body;
    
    if (!chunk || !Array.isArray(chunk)) {
      return res.status(400).json({ error: "Invalid chunk data" });
    }

    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    await collection.insertOne({
      index,
      data: JSON.stringify(chunk),
      timestamp: new Date()
    });

    res.json({ success: true, message: `Chunk ${index} uploaded successfully` });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    res.status(500).json({ error: "Failed to upload chunk" });
  }
});

app.post("/api/data/upload", async (req, res) => {
  try {
    const { chunks } = req.body;
    
    if (!chunks || !Array.isArray(chunks)) {
      return res.status(400).json({ error: "Invalid chunks data" });
    }

    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    
    // Clear existing data
    await collection.deleteMany({});
    
    // Insert new chunks
    if (chunks.length > 0) {
      const documents = chunks.map((chunk, index) => ({
        index,
        data: JSON.stringify(chunk),
        timestamp: new Date()
      }));
      
      await collection.insertMany(documents);
    }

    res.json({ success: true, message: "Data uploaded successfully" });
  } catch (error) {
    console.error("Error uploading data:", error);
    res.status(500).json({ error: "Failed to upload data" });
  }
});

app.delete("/api/data/clear", async (req, res) => {
  try {
    const database = await getDb();
    const collection = database.collection("revenue_chunks");
    await collection.deleteMany({});
    res.json({ success: true, message: "Data cleared successfully" });
  } catch (error) {
    console.error("Error clearing data:", error);
    res.status(500).json({ error: "Failed to clear data" });
  }
});

async function startServer() {
  await connectToMongo();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();