import SwiftUI

@main
struct PortuguesApp: App {
    @State private var vocab = VocabStore()
    @State private var progress = ProgressStore()
    @State private var speaker = Speaker()
    @AppStorage("appearance") private var appearance = "auto"

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(vocab)
                .environment(progress)
                .environment(speaker)
                .preferredColorScheme(appearance == "light" ? .light : appearance == "dark" ? .dark : nil)
                .task {
                    progress.useRenames(vocab.renamed)
                    await vocab.refreshFromWeb()
                    progress.useRenames(vocab.renamed)
                }
        }
    }
}

/// Which side is the front: Portuguese, English, or a random mix.
enum Direction: String, CaseIterable, Identifiable {
    case ptEn = "pt-en", enPt = "en-pt", both = "both"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .ptEn: "PT → EN"
        case .enPt: "EN → PT"
        case .both: "Both"
        }
    }
    /// For "both", pick a side at random for each card.
    func resolved() -> Direction {
        self == .both ? (Bool.random() ? .ptEn : .enPt) : self
    }
}

/// A learning or quiz session shown full screen.
struct SessionRequest: Identifiable {
    enum Kind { case learn, quiz }
    let id = UUID()
    let kind: Kind
    let cards: [Card]
    let pool: [Card]
    let title: String
}

struct RootView: View {
    @AppStorage("seenHelp") private var seenHelp = false
    @State private var showWelcome = false

    var body: some View {
        NavigationStack {
            HomeView()
        }
        .onAppear { if !seenHelp { showWelcome = true } }
        .sheet(isPresented: $showWelcome, onDismiss: { seenHelp = true }) {
            NavigationStack { HelpView(firstTime: true) }
        }
    }
}

// MARK: - Shared styling

extension Color {
    /// Deep green for filled buttons: white text stays readable in light and dark mode.
    static let buttonGreen = Color(red: 10/255, green: 125/255, blue: 75/255)   // #0A7D4B
}

extension View {
    /// Keeps content at a comfortable width on iPad / Mac and centres it (no effect on iPhone).
    func readableWidth(_ max: CGFloat = 720) -> some View {
        frame(maxWidth: max).frame(maxWidth: .infinity)
    }

    /// White rounded "card" look used throughout the app.
    func surface(radius: CGFloat = 18) -> some View {
        background(RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Color(uiColor: .secondarySystemGroupedBackground))
            .shadow(color: .black.opacity(0.06), radius: 8, y: 3))
    }
}

struct ProgressBar: View {
    let value: Double // 0...1
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.15))
                Capsule().fill(Color.accentColor).frame(width: max(0, g.size.width * value))
            }
        }
        .frame(height: 5)
    }
}
