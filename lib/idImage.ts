import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export interface PickedIdImage {
  uri: string;
  base64: string;
}

// A Firestore document can't be larger than 1 MiB, and a phone photo is
// several MB. The photo of the physical OSCA ID is therefore resized and
// re-compressed until its base64 text is comfortably under that limit. The
// admin portal also copies it into the digital ID, which has its own cap.
const MAX_BASE64_CHARS = 600_000;

// Tried in order until the result is small enough; the first is the sharpest.
const ATTEMPTS: { width: number; compress: number }[] = [
  { width: 1280, compress: 0.6 },
  { width: 1024, compress: 0.5 },
  { width: 800, compress: 0.45 },
];

/** Opens the photo library, returns null if the person cancels. */
export async function pickIdImage(): Promise<PickedIdImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw Object.assign(new Error("Please allow access to your photo library."), { code: "photo-permission" });
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    // No cropping: the admin needs to see the whole card.
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  for (const attempt of ATTEMPTS) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > attempt.width) context.resize({ width: attempt.width });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: attempt.compress,
      base64: true,
    });
    if (saved.base64 && saved.base64.length <= MAX_BASE64_CHARS) {
      return { uri: saved.uri, base64: saved.base64 };
    }
  }
  throw Object.assign(
    new Error("That photo is too large. Please take a closer, clearer photo of the ID."),
    { code: "photo-too-large" },
  );
}
