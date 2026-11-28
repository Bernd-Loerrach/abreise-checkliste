import SwiftUI
import UIKit

/// Size of the app window, so layouts can react to the iPhone Duo's inner screen:
/// held vertically it shows two panes (learning on top, word details below);
/// held horizontally the app may share the screen with another app and simply adapts to its half.
@MainActor
@Observable
final class WindowInfo {
    var size: CGSize = .zero

    /// Tall window with room for two panes (iPhone Duo inner screen held vertically, iPad portrait).
    var twoPane: Bool {
        size.width >= 600 && size.height >= 900 && size.height > size.width
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

/// Rotation: the iPhone Duo (outer screen 466 pt wide, inner screen) and iPad may turn – and share the screen
/// with another app; regular iPhones (at most 440 pt wide) stay upright as before.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        guard let screen = window?.windowScene?.screen.bounds.size else { return .all }
        return min(screen.width, screen.height) >= 450 ? .all : .portrait
    }
}
