/** Image carousel 2 (Section library): a coverflow, one large picture in the centre and the others behind it. Same editor as Image carousel. */
import type { HeadersFunction, ShouldRevalidateFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { carouselAction, carouselLoader } from "../lib/image-carousel-route.server";
import { ImageCarouselEditor } from "../components/ImageCarouselEditor";

export const loader = carouselLoader("coverflow");
export const action = carouselAction("coverflow");

export default function ImageCarousel2Page() {
  return <ImageCarouselEditor />;
}

/** Storing a draft for "Preview on store" must not reload the page (that would drop unsaved changes). */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
