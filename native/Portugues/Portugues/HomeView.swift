import SwiftUI

struct HomeView: View {
    @Environment(VocabStore.self) private var vocab
    @Environment(ProgressStore.self) private var progress
    @AppStorage("direction") private var direction = Direction.ptEn.rawValue
    @State private var session: SessionRequest?
    @State private var statHint: String?

    var body: some View {
        let s = progress.stats(vocab.allCards)
        let learnCount = s.due + min(s.new, ProgressStore.learnBatch)

        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("\(vocab.allCards.count) words")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .padding(.top, -6)

                Picker("Direction", selection: $direction) {
                    ForEach(Direction.allCases) { Text($0.label).tag($0.rawValue) }
                }
                .pickerStyle(.segmented)

                HStack(spacing: 10) {
                    statBox(s.due, "Due", key: "due", accent: true)
                    statBox(s.learned, "Learned", key: "learned")
                    statBox(s.new, "New", key: "new")
                }
                if let statHint {
                    Text(statHint)
                        .font(.subheadline)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .surface(radius: 14)
                        .transition(.opacity)
                }

                Button {
                    let q = progress.learnQueue(vocab.allCards)
                    if !q.isEmpty { session = SessionRequest(kind: .learn, cards: q, pool: vocab.allCards, title: "Learn") }
                } label: {
                    bigButton(emoji: "🎯", title: "Learn",
                              sub: learnCount == 0 ? "All done – come back later" : "Due reviews + new words",
                              badge: learnCount == 0 ? "✓" : "\(learnCount)", primary: true)
                }
                .buttonStyle(.plain)
                .disabled(learnCount == 0)

                Button {
                    session = SessionRequest(kind: .quiz, cards: Array(vocab.allCards.shuffled().prefix(10)),
                                             pool: vocab.allCards, title: "Quiz")
                } label: {
                    bigButton(emoji: "🧩", title: "Quiz", sub: "Multiple choice over all words", badge: nil, primary: false)
                }
                .buttonStyle(.plain)

                Text("TOPICS")
                    .font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                    .padding(.top, 10).padding(.leading, 4)

                ForEach(vocab.decks) { deck in
                    NavigationLink(value: deck) { DeckRow(deck: deck) }
                        .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Português 🇵🇹")
        .navigationDestination(for: Deck.self) { DeckView(deck: $0, session: $session) }
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                MuteButton()
                NavigationLink { HelpView(firstTime: false) } label: { Image(systemName: "info.circle") }
                NavigationLink { SettingsView() } label: { Image(systemName: "gearshape") }
            }
        }
        .fullScreenCover(item: $session) { req in
            switch req.kind {
            case .learn: LearnSessionView(queue: req.cards, title: req.title)
            case .quiz: QuizView(questions: req.cards, pool: req.pool, title: req.title)
            }
        }
    }

    private static let hints = [
        "due": "Due – words scheduled for review today. Learn works through them first.",
        "learned": "Learned – words you got right on two different days. Your first “Got it” starts the clock: the word comes back tomorrow, and if you know it again, it counts as learned.",
        "new": "New – words you haven't practised yet. Each Learn session adds up to \(ProgressStore.learnBatch) of them.",
    ]

    private func statBox(_ n: Int, _ label: String, key: String, accent: Bool = false) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.2)) {
                statHint = statHint == Self.hints[key] ? nil : Self.hints[key]
            }
        } label: {
            VStack(spacing: 2) {
                Text("\(n)").font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(accent ? Color.accentColor : .primary)
                Text(label.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .surface()
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.accentColor, lineWidth: statHint == Self.hints[key] ? 2 : 0))
        }
        .buttonStyle(.plain)
    }

    private func bigButton(emoji: String, title: String, sub: String, badge: String?, primary: Bool) -> some View {
        HStack(spacing: 14) {
            Text(emoji).font(.system(size: 30))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.title3.weight(.bold))
                Text(sub).font(.subheadline).opacity(0.85)
            }
            Spacer()
            if let badge {
                Text(badge).font(.headline)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Capsule().fill(.white.opacity(primary ? 0.25 : 0)))
            } else {
                Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
        }
        .padding(18)
        .foregroundStyle(primary ? .white : .primary)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(primary ? Color.accentColor : Color(uiColor: .secondarySystemGroupedBackground))
            .shadow(color: .black.opacity(0.06), radius: 8, y: 3))
    }
}

struct DeckRow: View {
    @Environment(ProgressStore.self) private var progress
    let deck: Deck

    var body: some View {
        let s = progress.stats(deck.cards)
        HStack(spacing: 14) {
            Text(deck.icon)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .frame(width: 44, height: 44)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(deck.name).font(.headline)
                    Text(deck.namePt).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Text("\(s.learned) / \(s.total) learned").font(.caption).foregroundStyle(.secondary)
                ProgressBar(value: s.total == 0 ? 0 : Double(s.learned) / Double(s.total))
            }
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .padding(14)
        .surface()
        .contentShape(Rectangle())
    }
}
