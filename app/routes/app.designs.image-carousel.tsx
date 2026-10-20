/** Image carousel (Section library): pictures side by side. Same editor as Image carousel 2 (components/ImageCarouselEditor.tsx). */
import type { HeadersFunction, ShouldRevalidateFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { carouselAction, carouselLoader } from "../lib/image-carousel-route.server";
import { ImageCarouselEditor } from "../components/ImageCarouselEditor";

export const loader = carouselLoader("image_carousel");
export const action = carouselAction("image_carousel");

export default function ImageCarouselPage() {
  return <ImageCarouselEditor />;
}

/** Storing a draft for "Preview on store" must not reload the page (that would drop unsaved changes). */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
