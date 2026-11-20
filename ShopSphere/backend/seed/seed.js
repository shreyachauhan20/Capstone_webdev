const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryLog = require("../models/InventoryLog");
const Notification = require("../models/Notification");

dotenv.config();

// Development-only sample accounts (never use these in production)
const SEED_USERS = [
  {
    name: "ShopSphere Admin",
    email: "admin@shopsphere.local",
    password: "Admin@123",
    role: "admin",
  },
  {
    name: "TechWorld Seller",
    email: "seller1@shopsphere.local",
    password: "Seller@123",
    role: "seller",
  },
  {
    name: "StyleHub Seller",
    email: "seller2@shopsphere.local",
    password: "Seller@123",
    role: "seller",
  },
  {
    name: "Aarav Customer",
    email: "customer1@shopsphere.local",
    password: "Customer@123",
    role: "customer",
  },
  {
    name: "Priya Customer",
    email: "customer2@shopsphere.local",
    password: "Customer@123",
    role: "customer",
  },
];

const SEED_CATEGORIES = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Smartphones, laptops, audio gear, and smart devices",
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Everyday apparel, footwear, and lifestyle wear",
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Kitchen appliances, cookware, and home essentials",
  },
  {
    name: "Beauty",
    slug: "beauty",
    description: "Skincare serums, moisturizers, and fragrances",
  },
  {
    name: "Accessories",
    slug: "accessories",
    description: "Chargers, headphones, watches, and daily add-ons",
  },
];

const seedDatabase = async () => {
  try {
    await connectDB();

    // 1. Seed Users idempotently (upsert by unique email)
    const usersByEmail = {};
    for (const u of SEED_USERS) {
      let existing = await User.findOne({ email: u.email });
      if (!existing) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        existing = await User.create({
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
        });
      }
      usersByEmail[u.email] = existing;
    }

    const seller1 = usersByEmail["seller1@shopsphere.local"];
    const seller2 = usersByEmail["seller2@shopsphere.local"];
    const customer1 = usersByEmail["customer1@shopsphere.local"];

    // 2. Seed Categories idempotently (upsert by unique slug)
    const categoriesBySlug = {};
    for (const cat of SEED_CATEGORIES) {
      const doc = await Category.findOneAndUpdate(
        { slug: cat.slug },
        { $setOnInsert: cat },
        { upsert: true, new: true }
      );
      categoriesBySlug[cat.slug] = doc;
    }

    // 3. Seed 25 realistic INR products across Electronics, Fashion, Home & Kitchen, Beauty, and Accessories
    const sampleProducts = [
      // Electronics (5)
      {
        title: "Galaxy S24 Pro 5G",
        description:
          "6.7-inch AMOLED 120Hz display, 256GB UFS storage, and flagship triple camera system.",
        price: 74999,
        brand: "Samsung",
        thumbnail:
          "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80",
        stock: 15,
        lowStockThreshold: 5,
        category: categoriesBySlug.electronics._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "Pixel 9 Compact",
        description:
          "Clean Android smartphone with advanced computational photography and all-day adaptive battery.",
        price: 62999,
        brand: "Google",
        thumbnail:
          "https://live.staticflickr.com/65535/51638715279_76026d23f7_b.jpg",
        stock: 4,
        lowStockThreshold: 5,
        category: categoriesBySlug.electronics._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "ThinkBook Pro 14 Laptop",
        description:
          "14-inch anti-glare IPS laptop with 16GB DDR5 RAM, 512GB NVMe SSD, and backlit keyboard.",
        price: 68500,
        brand: "Lenovo",
        thumbnail:
          "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
        stock: 9,
        lowStockThreshold: 3,
        category: categoriesBySlug.electronics._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "ZenBook Air 13 Ultrabook",
        description:
          "Ultra-light aluminum laptop engineered for college students, developers, and travel productivity.",
        price: 82000,
        brand: "Asus",
        thumbnail:
          "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80",
        stock: 3,
        lowStockThreshold: 5,
        category: categoriesBySlug.electronics._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "Pulse Watch Pro AMOLED",
        description:
          "Bluetooth calling smartwatch with 1.43-inch AMOLED display, SpO2 monitor, and 10-day battery.",
        price: 4999,
        brand: "Noise",
        thumbnail:
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
        stock: 20,
        lowStockThreshold: 5,
        category: categoriesBySlug.electronics._id,
        seller: seller1._id,
        isActive: true,
      },

      // Fashion (5)
      {
        title: "Classic Indigo Denim Jacket",
        description:
          "100% cotton washed denim trucker jacket with dual chest pockets and metal button closure.",
        price: 2499,
        brand: "UrbanLoom",
        thumbnail:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Jean_jacket.jpg/960px-Jean_jacket.jpg",
        stock: 18,
        lowStockThreshold: 5,
        category: categoriesBySlug.fashion._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Essential Cotton Polo T-Shirt",
        description:
          "Breathable combed pique cotton polo shirt tailored for smart-casual everyday comfort.",
        price: 999,
        brand: "Wrogn",
        thumbnail:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Vintage_90%27s_Lacoste_Polo_Shirt.jpg/960px-Vintage_90%27s_Lacoste_Polo_Shirt.jpg",
        stock: 35,
        lowStockThreshold: 8,
        category: categoriesBySlug.fashion._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "AeroStride Running Sneakers",
        description:
          "Lightweight breathable knit running shoes with responsive EVA cushioning and non-slip sole.",
        price: 3299,
        brand: "Campus",
        thumbnail:
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
        stock: 14,
        lowStockThreshold: 4,
        category: categoriesBySlug.fashion._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Canvas Street Low-Top Sneakers",
        description:
          "Minimalist everyday canvas sneakers with vulcanized rubber outsole and padded collar.",
        price: 1799,
        brand: "RedTape",
        thumbnail:
          "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?auto=format&fit=crop&w=800&q=80",
        stock: 26,
        lowStockThreshold: 6,
        category: categoriesBySlug.fashion._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Fleece Zip-Up Winter Hoodie",
        description:
          "Warm brushed cotton-blend hooded sweatshirt ideal for cool evenings and campus wear.",
        price: 1599,
        brand: "Highlander",
        thumbnail:
          "https://live.staticflickr.com/3860/15023141998_647297aa8a_b.jpg",
        stock: 19,
        lowStockThreshold: 5,
        category: categoriesBySlug.fashion._id,
        seller: seller2._id,
        isActive: true,
      },

      // Home & Kitchen (5)
      {
        title: "AeroCrisp Digital Air Fryer 4.5L",
        description:
          "1400W rapid-air circulation fryer with digital touch presets and non-stick dishwasher-safe basket.",
        price: 5499,
        brand: "Philips",
        thumbnail:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Air_Fryer_2020.jpg/960px-Air_Fryer_2020.jpg",
        stock: 11,
        lowStockThreshold: 4,
        category: categoriesBySlug["home-kitchen"]._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "BaristaBrew Electric Kettle 1.5L",
        description:
          "Double-wall stainless steel kettle with auto shut-off, boil-dry protection, and cool-touch exterior.",
        price: 1299,
        brand: "Prestige",
        thumbnail:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/2023_Czajnik_elektryczny_Bosch_%281%29.jpg/960px-2023_Czajnik_elektryczny_Bosch_%281%29.jpg",
        stock: 28,
        lowStockThreshold: 6,
        category: categoriesBySlug["home-kitchen"]._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "Granite Non-Stick Cookware Set",
        description:
          "3-piece PFOA-free induction-compatible frying pan, kadhai, and tadka pan with tempered glass lid.",
        price: 2799,
        brand: "Milton",
        thumbnail:
          "https://live.staticflickr.com/65535/48932341417_15dd48849c_b.jpg",
        stock: 16,
        lowStockThreshold: 5,
        category: categoriesBySlug["home-kitchen"]._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Tri-Ply Stainless Steel Saucepan",
        description:
          "Heavy-gauge tri-ply cookware engineered for even heat distribution without hotspots.",
        price: 1499,
        brand: "Hawkins",
        thumbnail:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Hahn_16cm_Saucepan.jpg/960px-Hahn_16cm_Saucepan.jpg",
        stock: 4,
        lowStockThreshold: 5,
        category: categoriesBySlug["home-kitchen"]._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "NutriBlend 750W Mixer Grinder",
        description:
          "High-torque copper motor mixer grinder with 3 stainless steel jars for smoothies and spices.",
        price: 3699,
        brand: "Bajaj",
        thumbnail:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Fresh_fruits_and_a_blender_are_arranged_on_a_kitchen_counter_for_smoothie_preparation.jpg/960px-Fresh_fruits_and_a_blender_are_arranged_on_a_kitchen_counter_for_smoothie_preparation.jpg",
        stock: 13,
        lowStockThreshold: 4,
        category: categoriesBySlug["home-kitchen"]._id,
        seller: seller1._id,
        isActive: true,
      },

      // Beauty (5)
      {
        title: "HydraGlow 15% Vitamin C Serum",
        description:
          "Lightweight brightening facial serum formulated with Vitamin C, ferulic acid, and hyaluronic acid.",
        price: 699,
        brand: "DermaPure",
        thumbnail:
          "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA0L2JzMjMzLWltYWdlLmpwZw.jpg",
        stock: 30,
        lowStockThreshold: 6,
        category: categoriesBySlug.beauty._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Barrier Repair Ceramide Moisturizer",
        description:
          "Oil-free non-comedogenic daily gel moisturizer for deep hydration and calm skin barrier support.",
        price: 549,
        brand: "DermaPure",
        thumbnail:
          "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
        stock: 2,
        lowStockThreshold: 5,
        category: categoriesBySlug.beauty._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Daily Matte SPF 50 Sunscreen",
        description:
          "Zero white-cast broad-spectrum PA++++ sunscreen gel for humid Indian weather.",
        price: 499,
        brand: "Minimalist",
        thumbnail:
          "https://upload.wikimedia.org/wikipedia/commons/a/a2/Suncademy_airless_bottle_sunscreen_citronella_active_ingredients.jpg",
        stock: 42,
        lowStockThreshold: 8,
        category: categoriesBySlug.beauty._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Midnight Oud Eau De Parfum",
        description:
          "Long-lasting woody amber and spice evening fragrance in a 100ml glass spray bottle.",
        price: 2999,
        brand: "AromaCraft",
        thumbnail:
          "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=800&q=80",
        stock: 21,
        lowStockThreshold: 5,
        category: categoriesBySlug.beauty._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "Citrus Breeze Fresh Cologne",
        description:
          "Crisp bergamot, neroli, and cedarwood daytime fragrance crafted for daily office wear.",
        price: 1899,
        brand: "Verve",
        thumbnail:
          "https://live.staticflickr.com/5747/30199411164_7bdb1fa38d_b.jpg",
        stock: 17,
        lowStockThreshold: 5,
        category: categoriesBySlug.beauty._id,
        seller: seller2._id,
        isActive: true,
      },

      // Accessories (5)
      {
        title: "Studio ANC Wireless Headphones",
        description:
          "Hybrid active noise cancellation, 40-hour battery life, multipoint Bluetooth, and USB-C fast charge.",
        price: 5499,
        brand: "SoundCore",
        thumbnail:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
        stock: 14,
        lowStockThreshold: 4,
        category: categoriesBySlug.accessories._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "65W GaN Dual USB-C Fast Charger",
        description:
          "Compact gallium-nitride power adapter supporting PD fast charging for laptops, tablets, and phones.",
        price: 1899,
        brand: "VoltEdge",
        thumbnail:
          "https://images.unsplash.com/photo-1600490722773-35753aea6332?auto=format&fit=crop&w=800&q=80",
        stock: 36,
        lowStockThreshold: 8,
        category: categoriesBySlug.accessories._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "Chrono Leather Analog Watch",
        description:
          "Minimalist stainless steel dial watch with genuine stitched leather strap and water resistance.",
        price: 3999,
        brand: "Titan",
        thumbnail:
          "https://live.staticflickr.com/696/20985611439_b65beafaae_b.jpg",
        stock: 12,
        lowStockThreshold: 4,
        category: categoriesBySlug.accessories._id,
        seller: seller2._id,
        isActive: true,
      },
      {
        title: "MagCharge 10000mAh Power Bank",
        description:
          "Slim 20W PD wireless and USB-C portable power bank with LED charge indicator.",
        price: 2199,
        brand: "Anker",
        thumbnail:
          "https://images.unsplash.com/photo-1566554738544-d962991c3fee?auto=format&fit=crop&w=800&q=80",
        stock: 24,
        lowStockThreshold: 5,
        category: categoriesBySlug.accessories._id,
        seller: seller1._id,
        isActive: true,
      },
      {
        title: "BassPods True Wireless Earbuds",
        description:
          "Low-latency TWS earbuds with quad-mic ENC calling and 32-hour pocket charging case.",
        price: 1499,
        brand: "boAt",
        thumbnail:
          "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
        stock: 29,
        lowStockThreshold: 6,
        category: categoriesBySlug.accessories._id,
        seller: seller1._id,
        isActive: true,
      },
    ];

    const createdProducts = [];
    for (const p of sampleProducts) {
      const { thumbnail, ...insertDefaults } = p;
      const doc = await Product.findOneAndUpdate(
        { title: p.title, seller: p.seller },
        {
          $set: { thumbnail },
          $setOnInsert: insertDefaults,
        },
        { upsert: true, new: true }
      );
      createdProducts.push(doc);
    }

    // 4. Seed one sample Order + InventoryLog + Notifications only if no orders exist yet
    const orderCount = await Order.countDocuments();
    if (orderCount === 0 && createdProducts.length >= 20) {
      const firstProd = createdProducts[0];
      const secondProd = createdProducts[15];
      const lowStockProd = createdProducts[1];

      const sampleOrder = await Order.create({
        user: customer1._id,
        items: [
          {
            product: firstProd._id,
            seller: firstProd.seller,
            title: firstProd.title,
            price: firstProd.price,
            thumbnail: firstProd.thumbnail,
            quantity: 1,
          },
          {
            product: secondProd._id,
            seller: secondProd.seller,
            title: secondProd.title,
            price: secondProd.price,
            thumbnail: secondProd.thumbnail,
            quantity: 2,
          },
        ],
        totalAmount: firstProd.price * 1 + secondProd.price * 2,
        shippingAddress: {
          name: customer1.name,
          email: customer1.email,
          address: "42 MG Road, Bengaluru, Karnataka",
        },
        paymentMethod: "upi",
        paymentStatus: "paid",
        status: "confirmed",
      });

      await InventoryLog.insertMany([
        {
          product: firstProd._id,
          changedBy: customer1._id,
          order: sampleOrder._id,
          changeType: "order_placed",
          quantityChanged: -1,
          previousStock: firstProd.stock + 1,
          newStock: firstProd.stock,
          note: "Seeded sample order deduction",
        },
        {
          product: secondProd._id,
          changedBy: customer1._id,
          order: sampleOrder._id,
          changeType: "order_placed",
          quantityChanged: -2,
          previousStock: secondProd.stock + 2,
          newStock: secondProd.stock,
          note: "Seeded sample order deduction",
        },
      ]);

      await Notification.insertMany([
        {
          user: customer1._id,
          title: "Order Confirmed",
          message: `Your seeded sample order #${sampleOrder._id.toString().slice(-6)} is confirmed.`,
          type: "order",
          relatedOrder: sampleOrder._id,
        },
        {
          user: seller1._id,
          title: "Low Stock Alert",
          message: `"${lowStockProd.title}" is below its low-stock threshold (${lowStockProd.stock} left).`,
          type: "low_stock",
          relatedProduct: lowStockProd._id,
        },
      ]);
    }

    console.log(
      `NexCart seed completed successfully (${createdProducts.length} products verified, idempotent).`
    );
    console.log("Development-only test accounts:");
    console.log("  Admin:      admin@nexcart.local     / Admin@123");
    console.log("  Seller 1:   seller1@nexcart.local   / Seller@123");
    console.log("  Seller 2:   seller2@nexcart.local   / Seller@123");
    console.log("  Customer 1: customer1@nexcart.local / Customer@123");
    console.log("  Customer 2: customer2@nexcart.local / Customer@123");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Seed script failed:", error.message);
    process.exit(1);
  }
};

seedDatabase();
