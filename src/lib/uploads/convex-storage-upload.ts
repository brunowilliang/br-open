import type { CroppedImage } from "@/lib/uploads/image-crop";

const DEFAULT_UPLOAD_ERROR_MESSAGE = "Não foi possível enviar a imagem.";

/**
 * Uploads a cropped image to Convex Storage.
 *
 * Returns the `{ storageId }` returned by the storage endpoint. Throws a plain
 * `Error` whose `message` is a generic PT-BR string on any failure (file read,
 * network, non-2xx status, malformed body, missing storageId). Callers that
 * want tailored toast copy should catch and surface their own message.
 */
export async function uploadImageToStorage(input: {
  file: CroppedImage;
  uploadUrl: string;
}): Promise<{ storageId: string }> {
  const { File: ExpoFile, UploadType } = await import("expo-file-system");

  let uploadFile: InstanceType<typeof ExpoFile>;
  try {
    uploadFile = new ExpoFile(input.file.uri);
  } catch (error) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE, { cause: error });
  }

  const contentType = input.file.mimeType || "image/jpeg";

  let uploadResponse: Awaited<ReturnType<typeof uploadFile.upload>>;
  try {
    uploadResponse = await uploadFile.upload(input.uploadUrl, {
      headers: {
        "Content-Type": contentType,
      },
      httpMethod: "POST",
      mimeType: contentType,
      uploadType: UploadType.BINARY_CONTENT,
    });
  } catch (error) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE, { cause: error });
  }

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE);
  }

  let uploadResponseBody: unknown;
  try {
    uploadResponseBody = JSON.parse(uploadResponse.body);
  } catch (error) {
    throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE, { cause: error });
  }

  if (
    typeof uploadResponseBody === "object" &&
    uploadResponseBody !== null &&
    "storageId" in uploadResponseBody &&
    typeof uploadResponseBody.storageId === "string" &&
    uploadResponseBody.storageId.trim()
  ) {
    return { storageId: uploadResponseBody.storageId };
  }

  throw new Error(DEFAULT_UPLOAD_ERROR_MESSAGE);
}
