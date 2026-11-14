import SwiftUI

/// Multiple choice: pick the right translation; answers count for spaced repetition.
struct QuizView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ProgressStore.self) private var progress
    @Environment(Speaker.self) private var speaker

    let questions: [Card]
    let pool: [Card]
    let title: String

    @State private var idx = 0
    @State private var correct = 0
    @State private var options: [Card] = []
    @State private var chosen: Card?
    @State private var dir = Direction.ptEn

    var body: some View {
        NavigationStack {
            Group {
                if idx >= questions.count {
                    DoneView(correct: correct, total: questions.count) { dismiss() }
                } else {
                    question(questions[idx])
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color(uiColor: .systemGroupedBackground))
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Exit") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) { MuteButton() }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear { prepare() }
    }

    private func prepare() {
        guard idx < questions.count else { return }
        let card = questions[idx]
        dir = (Direction(rawValue: UserDefaults.standard.string(forKey: "direction") ?? "") ?? .ptEn).resolved()
        let distractors = pool.filter { $0.id != card.id && back($0) != back(card) }.shuffled().prefix(3)
        options = ([card] + distractors).shuffled()
        chosen = nil
        if dir == .ptEn { speaker.speak(card.pt) }
    }

    private func front(_ c: Card) -> String { dir == .ptEn ? c.pt : c.en }
    private func back(_ c: Card) -> String { dir == .ptEn ? c.en : c.pt }

    private func question(_ card: Card) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                SessionHeader(title: title, index: idx + 1, total: questions.count)

                VStack(spacing: 10) {
                    Text(dir == .ptEn ? "PORTUGUÊS → ENGLISH" : "ENGLISH → PORTUGUÊS")
                        .font(.caption.weight(.bold)).tracking(1.2).foregroundStyle(.secondary)
                    Text(front(card))
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .multilineTextAlignment(.center)
                    if dir == .ptEn { SpeakButton(text: card.pt, size: 38) }
                }
                .padding(.vertical, 28).padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
                .surface(radius: 22)

                ForEach(options) { o in
                    Button { choose(o, card: card) } label: { optionLabel(o, card: card) }
                        .buttonStyle(.plain)
                }

                if chosen != nil {
                    Button {
                        idx += 1
                        prepare()
                    } label: {
                        Text("Continue ›").font(.headline).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(.vertical, 16)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color.buttonGreen))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 6)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
            .readableWidth(620)
        }
        .sensoryFeedback(.selection, trigger: chosen)
    }

    private func optionLabel(_ o: Card, card: Card) -> some View {
        let isRight = o.id == card.id
        let isPicked = chosen?.id == o.id
        let answered = chosen != nil
        let tint: Color = answered && isRight ? .accentColor : (answered && isPicked ? .red : .clear)
        return HStack {
            Text(back(o)).font(.body.weight(.medium)).multilineTextAlignment(.leading)
            Spacer()
            if answered && isRight { Text("✓").font(.headline).foregroundStyle(Color.accentColor) }
            if answered && isPicked && !isRight { Text("✗").font(.headline).foregroundStyle(.red) }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface(radius: 16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(tint, lineWidth: 2.5))
        .opacity(answered && !isRight && !isPicked ? 0.45 : 1)
    }

    private func choose(_ o: Card, card: Card) {
        guard chosen == nil else { return }
        chosen = o
        let ok = o.id == card.id
        if ok { correct += 1 }
        progress.rate(card.id, correct: ok)
        speaker.speak(card.pt)
    }
}
