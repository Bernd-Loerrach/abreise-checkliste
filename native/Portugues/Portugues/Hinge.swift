import SwiftUI
import UIKit

/// Hinge state of foldable iPhones (e.g. iPhone Duo).
/// When the device stands half open like a small laptop (inner screen sideways, fold across the middle),
/// learning and quiz screens put the card on the upper half and the controls on the lower half.
@MainActor
@Observable
final class HingeState {
    /// UIHinge.Status raw value: 0 unknown, 1 closed, 2 partially open, 3 fully open.
    var status = 0
    /// Size of the app window, used to find the fold (middle of the screen).
    var windowSize: CGSize = .zero
    /// For testing in the simulator: launch with `-forceHalfOpen YES`.
    private let forced = UserDefaults.standard.bool(forKey: "forceHalfOpen")

    /// Half open with the fold running across the screen (screen wider than tall).
    var halfOpen: Bool {
        (forced || status == 2) && windowSize.width > windowSize.height
    }

}

/// Invisible view that watches the hinge (iOS 27.1+) and the window size.
struct HingeReader: UIViewRepresentable {
    let state: HingeState

    func makeUIView(context: Context) -> HingeWatcherView {
        let v = HingeWatcherView()
        v.state = state
        return v
    }

    func updateUIView(_ uiView: HingeWatcherView, context: Context) {}
}

final class HingeWatcherView: UIView {
    weak var state: HingeState?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        if #available(iOS 27.1, *) {
            addInteraction(UIHingeInteraction { [weak self] _, update in
                self?.state?.status = update.hinge?.status.rawValue ?? 0
            })
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        if let size = window?.bounds.size, size != state?.windowSize { state?.windowSize = size }
    }
}
