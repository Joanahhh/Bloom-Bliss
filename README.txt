Put your product photos in this folder.
The file names the shop is looking for right now (change them in index.html if you prefer other names):

classic-red-rose-bouquet.jpg
pink-tulip-bouquet.jpg
white-lily-arrangement.jpg
sunflower-delight.jpg
burgundy-romance-bouquet.jpg
blush-pink-dream-bouquet.jpg
premium-mixed-flower-bouquet.jpg
mini-surprise-bouquet.jpg
preserved-rose-gift-box.jpg
bloom-and-bliss-signature-bouquet.jpg
peach-blossom-garden-bouquet.jpg
gentle-remembrance-lilies.jpg

----- OTHER PICTURES -----
Categories / Occasions / About: edit the src="..." of the <img> in index.html.
Customize page: put these in an  images/custom/  folder (missing files are simply skipped):
  customize-banner.jpg (in images/, top banner)
  size-small.jpg size-medium.jpg size-large.jpg
  flower-rose.jpg flower-tulip.jpg flower-sunflower.jpg flower-lily.jpg flower-daisy.jpg
  wrap-kraft.jpg wrap-blush.jpg wrap-burgundy.jpg wrap-ivory.jpg
  ribbon-burgundy.jpg ribbon-ivory.jpg ribbon-gold.jpg ribbon-sage.jpg
  card-none.jpg card-classic.jpg card-premium.jpg
To use other names or web links, edit the  image:  lines in script.js (inside CUSTOM).

----- BACKGROUND MUSIC -----
The site plays audio/palagi-sax-serenade-cover.mp3 from the music button.
Browsers may block autoplay; visitors can use the Play music button to start it.

----- SUPABASE SETUP -----
The storefront uses Supabase Auth and Postgres for accounts, profiles, products,
orders, reviews, preferences, customer chats, contact messages, and owner
notifications. The public project URL and publishable key are configured in
supabase-config.js. Never put a Supabase service-role key in browser code.

Database setup: supabase/schema.sql has been applied to the configured Supabase
project, and the app tables are visible in the public schema. For a fresh
Supabase project, open its SQL Editor and run supabase/schema.sql first.

To enable owner features:
1. Register the owner's account through the storefront using the intended owner
   email address, then confirm that email if Supabase requires confirmation.
2. In the SQL Editor, promote that verified account (replace the example email):
   update public.profiles set role = 'admin'
   where lower(email) = lower('owner@example.com');
3. Sign in to the storefront as the owner at least once. This seeds the initial
   storefront catalog in the products table. Customers can place orders only
   after this catalog sync has completed.

The schema migration is idempotent and configures row-level security. Existing
browser-only accounts and their password hashes are not imported; each user
must register a Supabase Auth account again. Payments remain demo-only. The
dashboard must report a healthy project and the schema must be applied before
cloud-backed pages can load successfully.
