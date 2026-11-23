import SwiftUI

/// ⭐ Difficult words: the starred words, to practise or quiz anytime.
struct FavoritesView: View {
    @Environment(VocabStore.self) private var vocab
    @Environment(ProgressStore.self) private var progress
    @Binding var session: SessionRequest?

    var body: some View {
        let cards = progress.favoriteCards(vocab.allCards)
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Palavras difíceis · \(cards.count) word\(cards.count == 1 ? "" : "s")")
                    .font(.subheadline).foregroundStyle(.secondary)

                Text("Tap **☆** on any card or word to star it. Starred words come **first** in Learn and come back after **\(Int(ProgressStore.favMaxDays)) days at the latest**, even when you know them. Remove the star once a word sits.")
                    .font(.subheadline)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .surface(radius: 14)

                Button {
                    session = SessionRequest(kind: .learn, cards: cards.shuffled(), pool: cards, title: "Difficult words")
                } label: {
                    row(emoji: "🎯", title: "Practise these", sub: cards.count == 1 ? "1 starred word" : "All \(cards.count) starred words", primary: true)
                }
                .buttonStyle(.plain)
                .disabled(cards.isEmpty)
                .opacity(cards.isEmpty ? 0.5 : 1)

                Button {
                    // Questions from the starred words, wrong options from all words.
                    session = SessionRequest(kind: .quiz, cards: Array(cards.shuffled().prefix(10)),
                                             pool: vocab.allCards, title: "Difficult words")
                } label: {
                    row(emoji: "🧩", title: "Quiz these", sub: "Multiple choice", primary: false)
                }
                .buttonStyle(.plain)
                .disabled(cards.isEmpty)
                .opacity(cards.isEmpty ? 0.5 : 1)

                if !cards.isEmpty {
                    Text("STARRED WORDS")
                        .font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                        .padding(.top, 10).padding(.leading, 4)

                    LazyVStack(spacing: 0) {
                        ForEach(cards) { card in
                            WordRow(card: card, learned: progress.isLearned(card.id))
                            if card.id != cards.last?.id { Divider().padding(.leading, 34) }
                        }
                    }
                    .padding(.vertical, 4)
                    .surface()
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
            .readableWidth()
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("⭐ Difficult words")
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
