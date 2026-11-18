import StoreView from "@/components/StoreView";

// Next.js 15: params on Promise. Next 14 puhul: ({ params }: { params: { id: string } }) ja ilma await'ita.
export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoreView id={id} />;
}
