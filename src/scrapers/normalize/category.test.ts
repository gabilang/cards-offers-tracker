import { describe, expect, it } from "vitest";
import { canonicalCategory } from "./category";

describe("canonicalCategory", () => {
  it.each([
    ["hotels & resorts", "Jetwing Hotels – 50% off", "hotels"],
    ["lodging", "20% Savings at Hilltop Villa", "hotels"],
    ["travel and leisure", "Villa Labugolla", "hotels"],
    ["leisure", "Colombo Zoo tickets travel", "travel"],
    ["food & restaurants", "Foody.lk", "dining"],
    ["restaurants", "Plates at Cinnamon Grand", "dining"],
    ["super markets", "Keells", "supermarkets"],
    ["supermarket", "Cargills Food City", "supermarkets"],
    ["homecare & electronics", "Singer", "electronics & home"],
    ["0% easy payment plans", "Abans", "installments"],
    ["online stores", "Daraz", "online"],
    ["shoes accessories", "DSI", "fashion"],
    ["jewelry", "Vogue", "jewellery"],
    ["autocare", "Tyre shop", "automobile"],
  ])("label %s", (label, text, expected) => expect(canonicalCategory(label, text)).toBe(expected));

  it.each([
    ["Up to 50% off on selected jewellery items at Ashadi Jewellers", "jewellery"],
    ["22% Savings on Reservations at Club palm Bay - Marawila", "hotels"],
    ["20% Savings on Credit & Debit cards at Red Orchids Chinese and Thai Restaurant", "dining"],
    ["Up to 12 months 0% installments at Serendip Gems", "jewellery"],
    ["Enjoy 30% Discount on Rides at PickMe", "online"],
    ["10% off at Random Merchant", "other"],
    ["Enjoy 10% OFF any single spa service at Urban Retreat Spa.", "health & wellness"],
    ["40% off on FB & HB basis at Swiss Residence", "hotels"],
    ["30% Savings on Resrvations at Habitat Kosgoda", "hotels"],
    ["Up to 50% off on selected items and services at U & H Wheel Service", "automobile"],
    ["Up to 60% on selected items at Singer www.singer.lk", "electronics & home"],
    ["20% off on total bill at www.hemasestore.com", "online"],
  ])("infers from text: %s", (text, expected) => expect(canonicalCategory(null, text)).toBe(expected));

  it("vague bank labels fall back to the offer text", () => {
    expect(canonicalCategory("premium card offers", "Dinner buffet at Shangri-La")).toBe("dining");
    expect(canonicalCategory("other offers", "Nothing specific")).toBe("other");
  });
});
