import {
  Utensils,
  ChefHat,
  Clock,
  CheckCircle2,
  Layers,
  Bell,
  Flame,
  Pizza,
  Soup,
  Sandwich,
  Salad,
  CupSoda,
  Coffee,
  IceCream2,
  Beef,
  Fish,
  Drumstick,
  Croissant,
  CakeSlice,
  Citrus,
  Grape,
  Apple,
  Candy,
  Wine,
  Milk,
  Thermometer,
  Timer,
  Package,
  Sparkles,
  ShoppingBasket,
} from "lucide-react";

import React from "react";

const makeEmojiIcon =
  (emoji) =>
  ({ size = 16, className = "" }) =>
    React.createElement(
      "span",
      {
        className,
        style: {
          fontSize: size,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "translateY(-1px)",
        },
      },
      emoji,
    );

export const KITCHEN_SECTION_ICON_OPTIONS = [
  { value: "utensils", label: "General", icon: Utensils },
  { value: "chef-hat", label: "Hot Station", icon: ChefHat },
  { value: "flame", label: "Grill", icon: Flame },
  { value: "pizza", label: "Pizza", icon: Pizza },
  { value: "soup", label: "Soup", icon: Soup },
  { value: "sandwich", label: "Sandwich", icon: Sandwich },
  { value: "salad", label: "Salad", icon: Salad },
  { value: "cup-soda", label: "Drinks", icon: CupSoda },
  { value: "coffee", label: "Coffee", icon: Coffee },
  { value: "ice-cream", label: "Dessert", icon: IceCream2 },
  { value: "beef", label: "Meat", icon: Beef },
  { value: "fish", label: "Seafood", icon: Fish },
  { value: "drumstick", label: "Fry", icon: Drumstick },
  { value: "croissant", label: "Bakery", icon: Croissant },
  { value: "cake", label: "Pastry", icon: CakeSlice },
  { value: "citrus", label: "Fresh", icon: Citrus },
  { value: "grape", label: "Fruit", icon: Grape },
  { value: "apple", label: "Produce", icon: Apple },
  { value: "candy", label: "Sweets", icon: Candy },
  { value: "wine", label: "Bar", icon: Wine },
  { value: "milk", label: "Dairy", icon: Milk },
  { value: "clock", label: "Prep", icon: Clock },
  { value: "timer", label: "Timed", icon: Timer },
  { value: "thermometer", label: "Temperature", icon: Thermometer },
  { value: "package", label: "Packaging", icon: Package },
  { value: "check-circle", label: "Pass", icon: CheckCircle2 },
  { value: "layers", label: "Assembly", icon: Layers },
  { value: "bell", label: "Expedite", icon: Bell },
  { value: "sparkles", label: "Special", icon: Sparkles },
  { value: "basket", label: "Pantry", icon: ShoppingBasket },
  { value: "noodles", label: "Noodles", icon: makeEmojiIcon("🍜") },
  { value: "pasta", label: "Pasta", icon: makeEmojiIcon("🍝") },
  { value: "bbq", label: "BBQ / Grill", icon: makeEmojiIcon("🔥") },
  { value: "spices", label: "Spices", icon: makeEmojiIcon("🧂") },
  { value: "sauces", label: "Sauces", icon: makeEmojiIcon("🥫") },
  { value: "vegetables", label: "Veg Prep", icon: makeEmojiIcon("🥗") },
  { value: "seaweed", label: "Sea / Wraps", icon: makeEmojiIcon("🌊") },
  { value: "noon-dessert", label: "Dessert Bar", icon: makeEmojiIcon("🍰") },
  { value: "breakfast", label: "Breakfast", icon: makeEmojiIcon("🍳") },
  { value: "late-night", label: "Late Night", icon: makeEmojiIcon("🌙") },
  { value: "cold", label: "Cold Prep", icon: makeEmojiIcon("🧊") },
  { value: "pack", label: "Takeaway Pack", icon: makeEmojiIcon("📦") },
];

const ICON_OPTION_MAP = new Map(
  KITCHEN_SECTION_ICON_OPTIONS.map((option) => [option.value, option]),
);

export const getKitchenSectionIconOption = (value) =>
  ICON_OPTION_MAP.get(value) || KITCHEN_SECTION_ICON_OPTIONS[0];

export const resolveKitchenSectionIconValue = (section) =>
  resolveKitchenSectionIconValueWithFallback(section, "utensils");

export const resolveKitchenSectionIconValueWithFallback = (
  section,
  fallbackValue = "utensils",
) => section?.icon || section?.sectionIcon || section?.iconKey || fallbackValue;
