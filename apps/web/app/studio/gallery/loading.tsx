import { LogoLoader } from "@/components/logo-icon"

export default function GalleryLoading() {
  return (
    <div className="min-h-full p-4 flex items-center justify-center">
      <LogoLoader size="md" text="Loading gallery" />
    </div>
  )
}
