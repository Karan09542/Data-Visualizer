/**
 * Downloads an image from a URL and saves it to the user's device.
 * Efforts are made to preserve the original filename and quality.
 */
export async function downloadImage(url: string, filename?: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    // Extract filename from URL if not provided
    if (!filename) {
      const urlParts = url.split("/");
      filename = urlParts[urlParts.length - 1].split("?")[0];
      if (!filename || filename.length < 3) {
        filename = "wikipedia-image.jpg";
      }
    }

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    return true;
  } catch (error) {
    console.error("Failed to download image:", error);
    return false;
  }
}
