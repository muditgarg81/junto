const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const matches = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  const connectionString = matches ? matches[1] : null;
  if (!connectionString) {
    console.error("Could not find DATABASE_URL in .env.local");
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    console.log("Creating users table if not exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        photo_url TEXT,
        phone VARCHAR(50),
        home_currency VARCHAR(10) DEFAULT 'INR',
        upi_id VARCHAR(255),
        chat_prefs JSONB NOT NULL DEFAULT '{"notifications": true, "mentions_only": false, "auto_download": "wifi", "save_to_gallery": true, "chat_theme": "paper", "font_size": 16}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("users table created.");

    // Check if default user exists
    const checkRes = await client.query("SELECT * FROM users WHERE auth_id = 'default-mudit-garg'");
    if (checkRes.rows.length === 0) {
      console.log("Seeding default user Mudit Garg...");
      await client.query(`
        INSERT INTO users (auth_id, name, email, upi_id, photo_url, phone, home_currency)
        VALUES (
          'default-mudit-garg',
          'Mudit Garg',
          'muditgarg81@gmail.com',
          'mudit@okhdfc',
          'https://lh3.googleusercontent.com/aida-public/AB6AXuC9tslox4ppPhb71H59NGSy_A4N-MZsnqGcwMUJfNSSFcXxIfofzSOFO51Pium1bHiV2mgi8_hBd3MzPYXAU9FjwpX2srdIZXWZcHc3DbjbnenBM2M2Hp8kjO_GEEX9FaFNkjBYiO8kJNhzBEOLeibFFverjXsQQ_sQlmxa9zcBzuXMytWDnBmG1cQUfj_LH20izh6nNAvEU79UgugTJlVtpmVpNeSfTZeNobKEpzrHP42XJraMLE_rmapsQWDsdfQECfc4cTXaSktW',
          '',
          '₹ INR'
        )
      `);
      console.log("Seeding completed.");
    } else {
      console.log("Default user Mudit Garg already exists.");
    }

    // Update existing members named 'mudit' to have the default auth_id if they have null auth_id
    console.log("Associating existing members named 'mudit' with default user auth_id...");
    await client.query(`
      UPDATE members 
      SET auth_id = 'default-mudit-garg' 
      WHERE (LOWER(name) = 'mudit' OR LOWER(name) = 'mudit garg') AND auth_id IS NULL
    `);
    console.log("Association completed.");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
