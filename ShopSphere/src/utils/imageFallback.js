// Maps a product's category or title to an existing local SVG fallback asset in /public/products/
export const getFallbackThumbnail = (product) => {
  const categorySlug = (product?.category?.slug || product?.category?.name || "")
    .toLowerCase();
  const title = (product?.title || "").toLowerCase();

  if (title.includes("laptop") || title.includes("ultrabook") || title.includes("thinkbook") || title.includes("zenbook")) {
    return "/products/laptop.svg";
  }
  if (title.includes("smartwatch") || title.includes("pulse watch")) {
    return "/products/smartwatch.svg";
  }
  if (title.includes("watch")) {
    return "/products/watch.svg";
  }
  if (title.includes("headphone") || title.includes("earbud") || title.includes("basspods")) {
    return "/products/headphones.svg";
  }
  if (title.includes("charger") || title.includes("power bank") || title.includes("magcharge")) {
    return "/products/charger.svg";
  }
  if (title.includes("sneaker") || title.includes("shoe")) {
    return "/products/sneakers.svg";
  }
  if (title.includes("jacket") || title.includes("polo") || title.includes("hoodie") || categorySlug.includes("fashion")) {
    return "/products/jacket.svg";
  }
  if (title.includes("cookware") || title.includes("saucepan") || title.includes("pan")) {
    return "/products/cookware.svg";
  }
  if (title.includes("fryer") || title.includes("kettle") || title.includes("mixer") || title.includes("blender") || categorySlug.includes("home")) {
    return "/products/appliance.svg";
  }
  if (title.includes("parfum") || title.includes("perfume") || title.includes("cologne")) {
    return "/products/perfume.svg";
  }
  if (title.includes("serum") || title.includes("moisturizer") || title.includes("sunscreen") || categorySlug.includes("beauty")) {
    return "/products/skincare.svg";
  }
  if (categorySlug.includes("accessor")) {
    return "/products/headphones.svg";
  }
  return "/products/smartphone.svg";
};
