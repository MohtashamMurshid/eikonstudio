import { Dithering } from "@paper-design/shaders-react"

export function BackgroundDither() {
  return (
    <div className="fixed inset-0 z-0 select-none">
      <Dithering
        colorBack="#00000000"
        colorFront="#260034"
        speed={0.43}
        shape="wave"
        type="4x4"
        pxSize={3}
        scale={1.13}
        style={{
          backgroundColor: "#000000",
          height: "100vh",
          width: "100vw",
        }}
      />
    </div>
  )
}

