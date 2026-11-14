import SwiftUI

/// Flashcard session: flip, rate yourself, missed words come back at the end.
struct LearnSessionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ProgressStore.self) private var progress
    @AppStorage("direction") private var directionRaw = Direction.ptEn.rawValue

    let title: String
    @State private var queue: [Card]
    @State private var idx = 0
    @State private var requeue: [Card] = []
    @State private var seen = Set<String>()
    @State private var correct = 0
    @State private var finished = false
    @State private var step = 0
    @State private var dir = Direction.ptEn   // fixed per card (matters for "Both")
    private let total: Int

    init(queue: [Card], title: String) {
        _queue = State(initialValue: queue)
        _dir = State(initialValue: (Direction(rawValue: UserDefaults.standard.string(forKey: "direction") ?? "") ?? .ptEn).resolved())
        self.title = title
        total = queue.count
    }

    var body: some View {
        NavigationStack {
            Group {
                if finished || queue.isEmpty {
                    DoneView(correct: correct, total: total) { dismiss() }
                } else {
                    VStack(spacing: 10) {
                        SessionHeader(title: title, index: min(seen.count + 1, total), total: total)
                        FlashcardView(card: queue[idx], direction: dir, onRate: rate)
                            .id(step)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                    .frame(maxHeight: 900)
                    .readableWidth(620)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .systemGroupedBackground))
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Exit") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { MuteButton() }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func pickDirection() {
        dir = (Direction(rawValue: directionRaw) ?? .ptEn).resolved()
    }

    private func rate(_ ok: Bool) {
        let card = queue[idx]
        progress.rate(card.id, correct: ok)
        if !seen.contains(card.id) {
            seen.insert(card.id)
            if ok { correct += 1 }
        }
        if !ok && !requeue.contains(card) { requeue.append(card) }
        idx += 1
        if idx >= queue.count {
            if requeue.isEmpty {
                finished = true
            } else {
                queue = requeue
                requeue = []
                idx = 0
            }
        }
        pickDirection()
        step += 1
    }
}

struct SessionHeader: View {
    let title: String
    let index: Int
    let total: Int

    var body: some View {
        VStack(spacing: 6) {
            ProgressBar(value: total == 0 ? 0 : Double(index - 1) / Double(total))
            HStack {
                Text(title)
                Spacer()
                Text("\(index) / \(total)")
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.secondary)
        }
        .padding(.top, 4)
    }
}

struct FlashcardView: View {
    @Environment(VocabStore.self) private var vocab
    @Environment(Speaker.self) private var speaker
    let card: Card
    let direction: Direction
    let onRate: (Bool) -> Void

    @State private var flipped = false
    @State private var revealed = false
    @State private var showConj = false

    private var frontText: String { direction == .ptEn ? card.pt : card.en }
    private var backText: String { direction == .ptEn ? card.en : card.pt }
    private var frontLang: String { direction == .ptEn ? "PORTUGUÊS" : "ENGLISH" }
    private var backLang: String { direction == .ptEn ? "ENGLISH" : "PORTUGUÊS" }

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                face(lang: frontLang, text: frontText, isBack: false)
                    .opacity(flipped ? 0 : 1)
                face(lang: backLang, text: backText, isBack: true)
                    .rotation3DEffect(.degrees(180), axis: (0, 1, 0))
                    .opacity(flipped ? 1 : 0)
            }
            .rotation3DEffect(.degrees(flipped ? 180 : 0), axis: (0, 1, 0), perspective: 0.5)
            .animation(.spring(response: 0.45, dampingFraction: 0.8), value: flipped)
            .onTapGesture { toggle() }
            .frame(maxHeight: 460)

            if revealed {
                HStack(spacing: 12) {
                    rateButton("✗ Not yet", color: .red, filled: false) { onRate(false) }
                    rateButton("✓ Got it", color: .buttonGreen, filled: true) { onRate(true) }
                }
            } else {
                rateButton("Show answer", color: .buttonGreen, filled: true) { toggle() }
            }
            Spacer(minLength: 0)
        }
        .sensoryFeedback(.selection, trigger: flipped)
        .onAppear { if direction == .ptEn { speaker.speak(card.pt) } }
        .sheet(isPresented: $showConj) {
            if let c = vocab.conjugation(for: card) { ConjugationSheet(card: card, entry: c) }
        }
    }

    private func toggle() {
        if !revealed { revealed = true }
        flipped.toggle()
        if flipped { speaker.speak(card.pt) }
    }

    private func face(lang: String, text: String, isBack: Bool) -> some View {
        VStack(spacing: 14) {
            Text(lang).font(.caption.weight(.bold)).tracking(1.5).foregroundStyle(.secondary)
                .padding(.top, 22)
            Spacer()
            Text(text)
                .font(.system(size: text.count > 14 ? 30 : 40, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.5)
                .padding(.horizontal, 20)
            if isBack, let note = card.note {
                Text(note).font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center).padding(.horizontal, 24)
            }
            // Speaker on whichever side shows Portuguese.
            if (direction == .ptEn) != isBack {
                SpeakButton(text: card.pt)
            }
            if isBack {
                HStack(spacing: 10) {
                    if vocab.conjugation(for: card) != nil {
                        Button { showConj = true } label: { chip("📖 Conjugation") }.buttonStyle(.plain)
                    }
                    Link(destination: PT.infopediaDict(card.pt)) { chip("📘 Infopedia") }
                }
            }
            Spacer()
            Text(isBack ? "Tap to flip back" : "Tap to flip").font(.footnote).foregroundStyle(.tertiary)
            if isBack {
                Text("\(card.deckIcon) \(card.deckName)").font(.caption.weight(.medium)).foregroundStyle(.secondary)
                    .padding(.bottom, 4)
            }
        }
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .surface(radius: 24)
        .contentShape(Rectangle())
    }

    private func chip(_ s: String) -> some View {
        Text(s).font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.accentColor)
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(Capsule().fill(Color.secondary.opacity(0.12)))
    }

    private func rateButton(_ label: String, color: Color, filled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.headline)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .foregroundStyle(filled ? .white : color)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(filled ? color : Color(uiColor: .secondarySystemGroupedBackground))
                    .shadow(color: .black.opacity(0.06), radius: 6, y: 2))
        }
        .buttonStyle(.plain)
    }
}

struct DoneView: View {
    let correct: Int
    let total: Int
    let onClose: () -> Void

    var body: some View {
        let pct = total == 0 ? 100 : Int((Double(correct) / Double(total) * 100).rounded())
        VStack(spacing: 14) {
            Text(pct >= 90 ? "🏆" : pct >= 60 ? "🎉" : "💪").font(.system(size: 64))
            Text("Well done!").font(.largeTitle.weight(.bold))
            Text("\(correct) of \(total) correct (\(pct)%)").font(.title3).foregroundStyle(.secondary)
            Text("Words you knew come back for review in a day or two. Get them right again and they count as **Learned**.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center).padding(.horizontal, 20)
            Button(action: onClose) {
                Text("Back to home").font(.headline).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.buttonGreen))
            }
            .buttonStyle(.plain)
            .padding(.top, 10)
        }
        .padding(28)
        .surface(radius: 24)
        .padding(16)
        .readableWidth(560)
    }
}
