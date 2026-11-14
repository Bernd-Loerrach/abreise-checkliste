import SwiftUI

/// One topic: learn it, quiz it, or browse all its words.
struct DeckView: View {
    @Environment(ProgressStore.self) private var progress
    let deck: Deck
    @Binding var session: SessionRequest?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("\(deck.namePt) · \(deck.cards.count) words")
                    .font(.subheadline).foregroundStyle(.secondary)

                Button {
                    session = SessionRequest(kind: .learn, cards: deck.cards.shuffled(), pool: deck.cards,
                                             title: deck.name)
                } label: {
                    row(emoji: "🎯", title: "Learn this topic", sub: "Practise all \(deck.cards.count) words", primary: true)
                }
                .buttonStyle(.plain)

                Button {
                    session = SessionRequest(kind: .quiz, cards: Array(deck.cards.shuffled().prefix(10)),
                                             pool: deck.cards, title: deck.name)
                } label: {
                    row(emoji: "🧩", title: "Quiz this topic", sub: "Multiple choice", primary: false)
                }
                .buttonStyle(.plain)
                .disabled(deck.cards.count < 4)

                Text("ALL WORDS")
                    .font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                    .padding(.top, 10).padding(.leading, 4)

                LazyVStack(spacing: 0) {
                    ForEach(deck.cards) { card in
                        WordRow(card: card, learned: progress.isLearned(card.id))
                        if card.id != deck.cards.last?.id { Divider().padding(.leading, 34) }
                    }
                }
                .padding(.vertical, 4)
                .surface()
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
            .readableWidth()
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(deck.name)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { MuteButton() } }
    }

    private func row(emoji: String, title: String, sub: String, primary: Bool) -> some View {
        HStack(spacing: 14) {
            Text(emoji).font(.system(size: 28))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(sub).font(.subheadline).opacity(0.85)
            }
            Spacer()
            Image(systemName: "chevron.right").opacity(0.7)
        }
        .padding(16)
        .foregroundStyle(primary ? .white : .primary)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(primary ? Color.buttonGreen : Color(uiColor: .secondarySystemGroupedBackground))
            .shadow(color: .black.opacity(0.06), radius: 8, y: 3))
    }
}

struct WordRow: View {
    @Environment(VocabStore.self) private var vocab
    let card: Card
    let learned: Bool
    @State private var showConj = false

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(learned ? Color.accentColor : Color.secondary.opacity(0.25))
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(card.pt).font(.body.weight(.semibold))
                Text(card.note.map { "\(card.en) · \($0)" } ?? card.en)
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            if vocab.conjugation(for: card) != nil {
                Button { showConj = true } label: {
                    Image(systemName: "book").frame(width: 34, height: 34)
                }
                .buttonStyle(.plain).foregroundStyle(Color.accentColor)
                .accessibilityLabel("Conjugation")
            }
            Link(destination: PT.infopediaDict(card.pt)) {
                Text("📘").frame(width: 34, height: 34)
            }
            .accessibilityLabel("Look up on Infopedia")
            SpeakButton(text: card.pt, size: 34)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .sheet(isPresented: $showConj) {
            if let c = vocab.conjugation(for: card) { ConjugationSheet(card: card, entry: c) }
        }
    }
}
