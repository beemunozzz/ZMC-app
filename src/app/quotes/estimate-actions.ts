"use server";

import { requireMember } from "@/lib/crew";
import { ROAD_FACTOR, getMeetSettings, milesBetween, milesToMinutes } from "@/lib/meet";
import { geocode } from "@/lib/weather";

export type TripEstimate = {
  error?: string;
  miles_out?: number;
  miles_between?: number;
  miles_back?: number;
  drive_out?: number;
  drive_back?: number;
};

const within = <T,>(p: Promise<T>, ms = 6000) => Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/**
 * Owner: rough miles and drive times from the shop (Zach's address) to the pickup, between the two
 * addresses, and from the drop-off back to the shop. Uses the free US Census map lookup and a
 * straight line x 1.25 for roads, so it's an estimate until Google Maps is set up.
 */
export async function estimateTrip(pickup: string, dropoff: string): Promise<TripEstimate> {
  const { supabase, me } = await requireMember();
  if (me?.role !== "owner") return { error: "Only the owner can do this." };
  if (!pickup.trim()) return { error: "Type the pickup address first." };
  const { shop_address } = await getMeetSettings(supabase);
  if (!shop_address) return { error: "Add the shop address first (☰ → Prices → Meeting at the shop)." };

  const [shop, a, b] = await Promise.all([within(geocode(shop_address)), within(geocode(pickup)), dropoff.trim() ? within(geocode(dropoff)) : Promise.resolve(null)]);
  if (!shop) return { error: "Couldn't find the shop address on the map." };
  if (!a) return { error: "Couldn't find the pickup address on the map. Check it has a street, city and state." };
  const road = (x: { lat: number; lon: number }, y: { lat: number; lon: number }) => Math.round(milesBetween(x, y) * ROAD_FACTOR);

  const end = b ?? a; // no drop-off address yet: assume the day ends at the pickup
  if (dropoff.trim() && !b) return { error: "Couldn't find the drop-off address on the map. Check it has a street, city and state." };
  const miles_out = road(shop, a);
  const miles_between = b ? road(a, b) : 0;
  const miles_back = road(end, shop);
  return {
    miles_out,
    miles_between,
    miles_back,
    drive_out: miles_out < 1 ? 0 : milesToMinutes(miles_out),
    drive_back: miles_back < 1 ? 0 : milesToMinutes(miles_back),
  };
}
