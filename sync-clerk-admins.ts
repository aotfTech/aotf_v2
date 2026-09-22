import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

async function syncClerkAdmins() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to DB");

  const Admin = mongoose.connection.collection("admins");
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
  
  if (!CLERK_SECRET_KEY) {
    console.error("No CLERK_SECRET_KEY found");
    return;
  }

  const res = await fetch("https://api.clerk.com/v1/users?limit=100", {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` }
  });

  const users = await res.json();
  let migrated = 0;
  let updated = 0;

  for (const user of users) {
    const meta = user.public_metadata;
    if (meta && meta.isAdmin === true) {
      const email = user.email_addresses[0]?.email_address;
      if (!email) continue;
      
      const existing = await Admin.findOne({ email });
      if (existing) {
        if (existing.clerkId !== user.id) {
          console.log(`Updating clerkId for ${email} from ${existing.clerkId} to ${user.id}`);
          await Admin.updateOne({ _id: existing._id }, { $set: { clerkId: user.id } });
          updated++;
        }
      } else {
        const byClerkId = await Admin.findOne({ clerkId: user.id });
        if (!byClerkId) {
          console.log(`Inserting new Admin for ${email}`);
          await Admin.insertOne({
            clerkId: user.id,
            email: email,
            name: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Admin User',
            username: `admin_${Math.floor(Math.random() * 10000)}`,
            role: meta.role || meta.aotfRole || "admin",
            isActive: true,
            status: "ACTIVE",
            permissions: meta.permissions || {},
            createdAt: new Date(),
            updatedAt: new Date()
          });
          migrated++;
        }
      }
    }
  }

  console.log(`Synced ${migrated} new admins. Updated ${updated} existing admins.`);
  await mongoose.disconnect();
}

syncClerkAdmins().catch(console.error);
