import type { Data } from "./turnos";

// Match the configured profile without embedding its RUT in plain text.
const PERSONALIZED_PROFILE = "8165998f70d27c41e036d3da4a9e5f7ee385c0143c609ccabd568b42d1d204cd";

export const PERSONALIZED_GREETINGS = [
  "Bienvenida de nuevo, amorcito.",
  "Bienvenida de nuevo, Ignacia ratón cookie.",
  "Bienvenida de nuevo, Ignacia 🐁🍪",
  "Bienvenida de nuevo, Tlacuache.",
  "Bienvenida de nuevo, Ratoncita.",
  "Bienvenida de nuevo, Larva.",
  "Bienvenida de nuevo, lindas patas.",
  "Bienvenida de nuevo, hoy agradecemos que hayas despertado siendo un gusano.",
  "Bienvenida de nuevo, te quiero muchito.",
  "Bienvenida de nuevo, solo pasaba a recordar de que siempre es un buen momento de regalar un juego de mesa a quien se ama.",
  "Bienvenida de nuevo, no importa cuando leas esto, te quiero muchito.",
  "Bienvenida de nuevo, mira lo que está haciendo el gato.",
  "Bienvenida de nuevo, el Canelio dice que quiere unos mimos.",
  "Bienvenida de nuevo, la Lulinga dice que quiere unos mimos.",
  "Bienvenida de nuevo, ¿vamos por unos masajitos?.",
] as const;

export function greetingFromDigest(digest: string, random: () => number = Math.random): string | undefined {
  if (digest !== PERSONALIZED_PROFILE) return undefined;
  return PERSONALIZED_GREETINGS[Math.floor(random() * PERSONALIZED_GREETINGS.length)];
}

export async function personalizedGreeting(profile: Pick<Data, "userRut">): Promise<string | undefined> {
  if (!profile.userRut) return undefined;
  const value = `${profile.userRut.number}-${profile.userRut.verifier.toUpperCase()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return greetingFromDigest(hex);
}
