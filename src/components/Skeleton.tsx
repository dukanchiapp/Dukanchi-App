import React from 'react';

const style = document.createElement('style');
style.textContent = `
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .dk-shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 37%, #f0f0f0 63%);
    background-size: 800px 100%;
    animation: shimmer 1.4s ease infinite;
  }
`;
if (!document.head.querySelector('[data-dk-shimmer]')) {
  style.setAttribute('data-dk-shimmer', '1');
  document.head.appendChild(style);
}

export function ShimmerBox({ width = '100%', height = 12, radius = 6, style: s = {} }: {
  width?: string | number; height?: number; radius?: number; style?: React.CSSProperties;
}) {
  return (
    <div
      className="dk-shimmer"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...s }}
    />
  );
}

export function PostCardSkeleton() {
  return (
    <div style={{
      background: 'white',
      border: '0.5px solid #f0f0f0',
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShimmerBox width={40} height={40} radius={12} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ShimmerBox width="45%" height={12} radius={6} />
          <ShimmerBox width="28%" height={9} radius={5} />
        </div>
        <ShimmerBox width={52} height={22} radius={20} />
      </div>
      <ShimmerBox width="100%" height={220} radius={0} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <ShimmerBox width="80%" height={11} radius={5} />
        <ShimmerBox width="55%" height={10} radius={5} />
      </div>
      <div style={{ padding: '8px 12px 12px', display: 'flex', gap: 16 }}>
        <ShimmerBox width={48} height={22} radius={20} />
        <ShimmerBox width={48} height={22} radius={20} />
        <ShimmerBox width={48} height={22} radius={20} />
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
      <ShimmerBox width={48} height={48} radius={24} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ShimmerBox width="50%" height={12} radius={6} />
        <ShimmerBox width="70%" height={10} radius={5} />
      </div>
      <ShimmerBox width={32} height={10} radius={5} />
    </div>
  );
}

export function StoreCardSkeleton() {
  return (
    <div style={{
      background: 'white',
      border: '0.5px solid #f0f0f0',
      borderRadius: 16,
      padding: 14,
      display: 'flex',
      gap: 12,
      marginBottom: 10,
    }}>
      <ShimmerBox width={56} height={56} radius={14} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <ShimmerBox width="55%" height={13} radius={6} />
        <ShimmerBox width="35%" height={10} radius={5} />
        <ShimmerBox width="45%" height={10} radius={5} />
      </div>
    </div>
  );
}
