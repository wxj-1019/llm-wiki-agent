interface JarvisAvatarProps {
  size?: number;
  isActive?: boolean;
}

export function JarvisAvatar({ size = 120, isActive = false }: JarvisAvatarProps) {
  return (
    <div
      className={`jarvis-avatar${isActive ? ' ja-active' : ''}`}
      style={{ '--ja-scale': size / 100 } as React.CSSProperties}
    >
      {/* Core blob effect container — blur+contrast applied at container level */}
      <div className="ja-blob-layer">
        <div className="ja-blob-container">
          <div className="ja-blob" style={{ '--i': 0 } as React.CSSProperties} />
          <div className="ja-blob" style={{ '--i': 1 } as React.CSSProperties} />
          <div className="ja-blob" style={{ '--i': 2 } as React.CSSProperties} />
          <div className="ja-blob" style={{ '--i': 3 } as React.CSSProperties} />
          <div className="ja-blob" style={{ '--i': 4 } as React.CSSProperties} />
          <div className="ja-blob" style={{ '--i': 5 } as React.CSSProperties} />
          <div className="ja-blob" style={{ '--i': 6 } as React.CSSProperties} />
        </div>
      </div>
      {/* Glass overlay: borders + inset shadow on top of blob */}
      <div
        className="ja-overlay"
        style={{
          opacity: isActive ? 1 : 0.65,
          transition: 'opacity 0.5s ease',
        }}
      />
    </div>
  );
}
