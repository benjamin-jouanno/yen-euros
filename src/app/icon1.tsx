import { ImageResponse } from "next/og";
import { IconArt } from "./icon-art";

export const size = {
  width: 192,
  height: 192,
};

export const contentType = "image/png";

export default function Icon192() {
  return new ImageResponse(<IconArt fontSize={70} />, size);
}
