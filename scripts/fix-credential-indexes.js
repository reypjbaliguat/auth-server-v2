/**
 * Script to fix the credential collection indexes
 * Run this to remove the problematic userId unique index and allow proper compound indexes
 */
const mongoose = require("mongoose");
require("dotenv").config();

async function fixCredentialIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const collection = mongoose.connection.db.collection("credentials");

    // List existing indexes
    const existingIndexes = await collection.listIndexes().toArray();
    console.log(
      "📋 Existing indexes:",
      existingIndexes.map((idx) => idx.name),
    );

    // Check if the problematic userId_1 index exists
    const hasUserIdIndex = existingIndexes.some(
      (idx) => idx.name === "userId_1",
    );

    if (hasUserIdIndex) {
      console.log("🗑️  Dropping problematic userId_1 index...");
      await collection.dropIndex("userId_1");
      console.log("✅ Dropped userId_1 index successfully");
    } else {
      console.log(
        "ℹ️  No userId_1 index found, it may have already been dropped",
      );
    }

    // The new indexes will be created automatically when the application starts
    // due to the CredentialSchema.index() calls in the model

    console.log(
      "✅ Index fix completed! Restart your application to create the new indexes.",
    );
  } catch (error) {
    console.error("❌ Error fixing indexes:", error);
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  fixCredentialIndexes().catch(console.error);
}

module.exports = { fixCredentialIndexes };
