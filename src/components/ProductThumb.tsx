// Ảnh nhỏ của món; nếu không có ảnh thì hiện chữ cái đầu trên nền màu
const COLORS = ['bg-teal-600', 'bg-amber-500', 'bg-rose-500', 'bg-sky-600', 'bg-violet-500', 'bg-lime-600', 'bg-orange-500']

export default function ProductThumb({ name, url, className = '' }: { name: string; url: string | null; className?: string }) {
  if (url) {
    return <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />
  }
  const color = COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % COLORS.length]
  return (
    <div className={`flex items-center justify-center font-bold text-white ${color} ${className}`}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}
