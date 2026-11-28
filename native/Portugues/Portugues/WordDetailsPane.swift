import SwiftUI

/// Lower pane on the iPhone Duo's vertical inner screen: everything about the current word.
/// Stays neutral until the card is flipped (or the quiz answered), so it never gives the answer away.
struct WordDetailsPane: View {
    @Environment(VocabStore.self) private var vocab
    let card: Card
    let revealed: Bool
    /// Quiz: "Continue" sits at the top of this pane, right where you read the details.
    var onContinue: (() -> Void)? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if revealed {
                    details
                } else {
                    placeholder
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .readableWidth(620)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .animation(.easeOut(duration: 0.2), value: revealed)
    }

    private var placeholder: some View {
        VStack(spacing: 10) {
            Text(card.deckIcon).font(.system(size: 40))
            Text(card.deckName).font(.headline)
            Text("Flip the card or answer – the word details appear here.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 30)
    }

    @ViewBuilder
    private var details: some View {
        if let onContinue {
            Button(action: onContinue) {
                Text("Continue ›").font(.headline).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color.buttonGreen))
            }
            .buttonStyle(.plain)
        }
        // The word itself
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(card.pt).font(.title2.weight(.bold))
                Text(card.en).font(.title3).foregroundStyle(.secondary)
            }
            Spacer()
            StarButton(id: card.id, size: 40)
            SpeakButton(text: card.pt, size: 40)
        }
        if let note = card.note {
            Text(note).font(.subheadline)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .surface(radius: 12)
        }

        if let entry = vocab.conjugation(for: card) {
            ConjugationTable(card: card, entry: entry)
                .padding(14)
                .surface(radius: 16)
        } else {
            Link(destination: PT.infopediaDict(card.pt)) {
                Label("Look up on Infopedia", systemImage: "arrow.up.right")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
            }
        }

        // More words from the same topic
        let others = topicWords
        if !others.isEmpty {
            Text("MORE FROM \(card.deckName.uppercased())")
                .font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                .padding(.top, 6)
            VStack(spacing: 0) {
                ForEach(others) { w in
                    HStack(spacing: 10) {
                        Text(w.pt).font(.body.weight(.semibold))
                        Text(w.en).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                        Spacer(minLength: 4)
                        SpeakButton(text: w.pt, size: 32)
                    }
                    .padding(.vertical, 8)
                    if w.id != others.last?.id { Divider() }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 4)
            .surface(radius: 16)
        }
    }

    /// Up to 6 neighbours of the word in its topic.
    private var topicWords: [Card] {
        guard let deck = vocab.decks.first(where: { $0.id == card.deckId }),
              let i = deck.cards.firstIndex(where: { $0.id == card.id }) else { return [] }
        let cards = deck.cards
        let lo = max(0, min(i - 3, cards.count - 7))
        return Array(cards[lo..<min(cards.count, lo + 7)]).filter { $0.id != card.id }.prefix(6).map { $0 }
    }
}
