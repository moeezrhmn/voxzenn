// Run with: node scripts/seed-demo.js
// Creates two demo accounts: Glamour Hair Studio + Luxe Nail Bar

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://ai_receptionist:ai_receptionist%23*123@38.242.215.102:5432/ai_receptionist",
  ssl: false,
});

const DEMO_PASSWORD = "VoxDemo2026!";

const demos = [
  {
    email: "demo-glamour@voxzenn.demo",
    config: {
      business_name: "Glamour Hair Studio",
      assistant_name: "Sophia",
      role: "receptionist",
      personality: "warm, friendly",
      capabilities: ["book appointments", "answer FAQs", "provide business information"],
      working_hours: "Tue-Sat 9am-7pm",
      greeting:
        "Hi! I'm Sophia, the AI receptionist for Glamour Hair Studio. I can help you book an appointment or answer any questions. How can I help you today?",
      faqs: {
        "What services do you offer?":
          "We offer haircuts, coloring, highlights, blowouts, keratin treatments, and styling for all hair types.",
        "How much is a haircut?":
          "Women's haircuts start at $45 and men's haircuts start at $25. Prices vary based on length and stylist.",
        "How much does coloring cost?":
          "Single process color starts at $75. Highlights and balayage start at $120. We'll give you an exact quote during your consultation.",
        "Do you accept walk-ins?":
          "We prefer appointments but do welcome walk-ins based on availability. Calling ahead is always recommended, especially on weekends.",
        "How long does a color appointment take?":
          "Color services typically take 2 to 3 hours depending on the service. Full highlights can take up to 3 and a half hours.",
        "Where are you located?":
          "We're at 247 Oak Street downtown, just two blocks from City Hall. Free parking is available in the lot behind the building.",
        "What are your cancellation policies?":
          "We ask for at least 24 hours notice for cancellations. Late cancellations or no-shows may incur a fee of up to 50% of the service price.",
        "Do you offer gift cards?":
          "Yes! We offer gift cards in any amount. You can purchase them in-studio or call us and we'll arrange delivery.",
      },
    },
  },
  {
    email: "demo-luxe@voxzenn.demo",
    config: {
      business_name: "Luxe Nail Bar",
      assistant_name: "Aria",
      role: "receptionist",
      personality: "friendly, casual",
      capabilities: ["book appointments", "answer FAQs", "provide business information"],
      working_hours: "Mon-Sat 10am-8pm",
      greeting:
        "Hey there! I'm Aria, the AI receptionist for Luxe Nail Bar. I can help you book an appointment or answer any questions you have. What can I do for you?",
      faqs: {
        "What nail services do you offer?":
          "We offer manicures, pedicures, gel nails, acrylic full sets and fills, dip powder, nail art, and paraffin wax treatments.",
        "How much is a gel manicure?":
          "A gel manicure is $38. A classic manicure is $22. Pedicures start at $35.",
        "How much is a full acrylic set?":
          "A full acrylic set starts at $55. Fills are $35. Nail art is priced separately based on the design.",
        "How long does a full set take?":
          "A full acrylic set takes about 1.5 to 2 hours. A gel manicure takes around 45 minutes.",
        "Do you accept walk-ins?":
          "Yes, we welcome walk-ins! That said, we do get very busy on Fridays and Saturdays, so booking ahead is recommended on those days.",
        "Where are you located?":
          "We're at 89 Maple Avenue, Suite 2. There's free street parking right outside the door.",
        "Do you have a loyalty program?":
          "We do! After 10 visits you earn a free classic manicure. Ask our staff for a loyalty card on your next visit.",
        "Are your products safe and non-toxic?":
          "Yes, we use only non-toxic, cruelty-free nail products. We're a 5-free salon — no formaldehyde, toluene, or DBP.",
      },
    },
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding demo accounts...\n");

    for (const demo of demos) {
      // Check if user already exists
      const existing = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [demo.email]
      );

      let userId;

      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        console.log(`↩  ${demo.email} already exists — updating config`);
      } else {
        const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
        const result = await client.query(
          "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
          [demo.email, hash]
        );
        userId = result.rows[0].id;
        console.log(`✓  Created user: ${demo.email} (id: ${userId})`);
      }

      // Upsert config
      await client.query(
        `INSERT INTO configs
           (client_id, user_id, business_name, role, personality, capabilities, working_hours, greeting, faqs, assistant_name)
         VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10)
         ON CONFLICT (client_id) DO UPDATE SET
           business_name  = EXCLUDED.business_name,
           role           = EXCLUDED.role,
           personality    = EXCLUDED.personality,
           capabilities   = EXCLUDED.capabilities,
           working_hours  = EXCLUDED.working_hours,
           greeting       = EXCLUDED.greeting,
           faqs           = EXCLUDED.faqs,
           assistant_name = EXCLUDED.assistant_name,
           updated_at     = NOW()`,
        [
          userId,
          userId,
          demo.config.business_name,
          demo.config.role,
          demo.config.personality,
          JSON.stringify(demo.config.capabilities),
          demo.config.working_hours,
          demo.config.greeting,
          JSON.stringify(demo.config.faqs),
          demo.config.assistant_name,
        ]
      );

      console.log(`✓  Config upserted: ${demo.config.business_name}`);
      console.log(`   Hours: ${demo.config.working_hours}`);
      console.log(`   FAQs: ${Object.keys(demo.config.faqs).length} entries\n`);
    }

    console.log("─────────────────────────────────────────");
    console.log("Demo accounts ready.\n");
    console.log("Glamour Hair Studio");
    console.log(`  Email:    demo-glamour@voxzenn.demo`);
    console.log(`  Password: ${DEMO_PASSWORD}\n`);
    console.log("Luxe Nail Bar");
    console.log(`  Email:    demo-luxe@voxzenn.demo`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log("─────────────────────────────────────────");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
