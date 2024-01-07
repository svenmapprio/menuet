import { parseIntForce } from "@/utils/helpers";
import { notFound } from "next/navigation";
import Place from "./Place";

export default function Page({ params }: { params: { id: string } }) {
  const placeId = parseIntForce(params.id);

  if (!placeId) return notFound();

  return <Place placeId={placeId} />;
}
