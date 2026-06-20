import type { UserPresence } from '@text-editor/shared'

export function normalizeUserName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function hashIdentity(value: string) {
  let hash = 2166136261
  for (const character of value.toLocaleLowerCase()) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const saturationRatio = saturation / 100
  const lightnessRatio = lightness / 100
  const chroma = (1 - Math.abs(2 * lightnessRatio - 1)) * saturationRatio
  const hueSection = hue / 60
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1))
  const offset = lightnessRatio - chroma / 2

  const [red, green, blue] =
    hueSection < 1
      ? [chroma, secondary, 0]
      : hueSection < 2
        ? [secondary, chroma, 0]
        : hueSection < 3
          ? [0, chroma, secondary]
          : hueSection < 4
            ? [0, secondary, chroma]
            : hueSection < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]

  return `#${[red, green, blue]
    .map(channel =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function getUserColor(name: string) {
  const hash = hashIdentity(normalizeUserName(name))
  const hue = Math.round((hash * 137.508) % 360)
  const saturation = 58 + (hash % 14)
  const lightness = 38 + ((hash >>> 8) % 9)
  return hslToHex(hue, saturation, lightness)
}

export function createUser(name: string): UserPresence {
  const normalizedName = normalizeUserName(name)
  const hash = hashIdentity(normalizedName)

  return {
    id: `user-${hash.toString(36)}`,
    name: normalizedName,
    color: getUserColor(normalizedName),
  }
}
