const SPLIT_LAT = 13.0618;
const BUFFER_DEG = 0.018; // ~2 km centre band

export function resolveChennaiZone(lat) {
  if (!lat || (lat >= SPLIT_LAT - BUFFER_DEG && lat <= SPLIT_LAT + BUFFER_DEG)) {
    return "Chennai North"; // centre band or no coords → default North
  }
  return lat > SPLIT_LAT ? "Chennai North" : "Chennai South";
}
