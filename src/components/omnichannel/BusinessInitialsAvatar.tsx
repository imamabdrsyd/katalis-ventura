interface Props {
  name: string;
  index: number;
  size?: 'sm' | 'md';
}

const COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
  { bg: 'bg-blue-100', text: 'text-blue-800' },
];

export function BusinessInitialsAvatar({ name, index, size = 'md' }: Props) {
  const color = COLORS[index % COLORS.length];
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const sizeClass =
    size === 'sm' ? 'w-9 h-9 text-xs rounded-lg' : 'w-11 h-11 text-sm rounded-xl';
  return (
    <div
      className={`${sizeClass} ${color.bg} ${color.text} flex items-center justify-center font-medium flex-shrink-0`}
    >
      {initials}
    </div>
  );
}
