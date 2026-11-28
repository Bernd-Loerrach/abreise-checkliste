import SwiftUI
import UIKit

/// Size of the app window, so layouts can react to the iPhone Duo's inner screen:
/// held vertically it shows two panes (learning on top, word details below);
/// held horizontally the app may share the screen with another app and simply adapts to its half.
@MainActor
@Observable
final class WindowInfo {
    var size: CGSize = .zero

    /// Tall, wide phone screen (iPhone Duo inner screen held vertically).
    var twoPane: Bool {
        UIDevice.current.userInterfaceIdiom == .phone && size.width >= 600 && size.height > size.width
    }
}

/// Invisible view that reports the window size.
struct WindowReader: UIViewRepresentable {
    let info: WindowInfo

    func makeUIView(context: Context) -> WindowWatcherView {
        let v = WindowWatcherView()
        v.info = info
        return v
    }

    func updateUIView(_ uiView: WindowWatcherView, context: Context) {}
}

final class WindowWatcherView: UIView {
    weak var info: WindowInfo?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        if let size = window?.bounds.size, size != info?.size { info?.size = size }
    }
}
