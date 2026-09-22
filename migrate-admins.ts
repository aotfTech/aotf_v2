import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to DB");

  const AdminUser = mongoose.connection.collection("adminusers");
  const Admin = mongoose.connection.collection("admins");

  const adminUsers = await AdminUser.find({}).toArray();
  let migrated = 0;

  for (const user of adminUsers) {
    if (!user.clerkUserId) continue;
    
    const existing = await Admin.findOne({ clerkId: user.clerkUserId });
    if (!existing) {
      console.log(`Migrating ${user.email}...`);
      await Admin.insertOne({
        clerkId: user.clerkUserId,
        email: user.email,
        name: user.name,
        username: user.email.split("@")[0] + "_" + Math.floor(Math.random() * 1000),
        role: user.role,
        isActive: user.status === "ACTIVE",
        status: user.status,
        permissions: {}, // rely on clerk metadata or defaults
        createdAt: new Date(),
        updatedAt: new Date()
      });
      migrated++;
    }
  }

  console.log(`Migrated ${migrated} users.`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
