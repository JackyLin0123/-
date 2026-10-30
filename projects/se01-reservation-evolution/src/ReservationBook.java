import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.TreeMap;

/** Original teaching model: single thread, nonnegative integer half-open slots. */
public class ReservationBook extends BaseBook {
    private final OverlapRule rule = new OverlapRule();
    public ReservationBook(Store store) { super(store); }
    protected boolean overlaps(Slot a, Slot b) { return rule.overlaps(a, b); }
}

/** Immutable element: a shallow outer-list copy safely isolates the whole result. */
final class Slot {
    final int id;
    final String resource;
    final int start;
    final int end;
    Slot(int id, String resource, int start, int end) {
        this.id = id; this.resource = resource; this.start = start; this.end = end;
    }
    public boolean equals(Object other) {
        if (!(other instanceof Slot)) { return false; }
        Slot s = (Slot) other;
        return id == s.id && resource.equals(s.resource) && start == s.start && end == s.end;
    }
    public int hashCode() { return java.util.Objects.hash(id, resource, start, end); }
    public String toString() { return id + ":" + resource + ":[" + start + "," + end + ")"; }
}

/** Service-private port; adapters return copies and complete each update atomically. */
interface Store {
    List<Slot> snapshot();
    void insert(Slot slot);
    boolean remove(int id);
}
final class ListStore implements Store {
    private final List<Slot> slots = new ArrayList<>();
    public List<Slot> snapshot() { return new ArrayList<>(slots); }
    public void insert(Slot slot) { slots.add(slot); }
    public boolean remove(int id) {
        for (int i = 0; i < slots.size(); i++) {
            if (slots.get(i).id == id) { slots.remove(i); return true; }
        }
        return false;
    }
}
final class TreeStore implements Store {
    private final TreeMap<Integer, Slot> slots = new TreeMap<>();
    public List<Slot> snapshot() { return new ArrayList<>(slots.values()); }
    public void insert(Slot slot) { slots.put(slot.id, slot); }
    public boolean remove(int id) { return slots.remove(id) != null; }
}
final class ConflictException extends IllegalStateException {
    ConflictException() { super("overlapping reservation"); }
}
final class OverlapRule {
    boolean overlaps(Slot a, Slot b) {
        return a.resource.equals(b.resource) && a.start < b.end && b.start < a.end;
    }
}

abstract class BaseBook {
    // AF: (set of active store slots, nextId). The marker affects future return values.
    // RI: valid slots; positive unique active IDs below nextId; no same-resource overlap;
    // 1 <= nextId <= MAX_INT+1. Historical nonreuse also relies on transition induction:
    // initially 1; successful reserve increments; failures/cancel/list never decrease it.
    private final Store store;
    private long nextId = 1;
    BaseBook(Store store) { this.store = java.util.Objects.requireNonNull(store); checkRep(); }
    protected abstract boolean overlaps(Slot a, Slot b);
    public int reserve(String resource, int start, int end) {
        if (resource == null || !resource.matches("[A-Za-z0-9_-]+") || start < 0 || start >= end) {
            throw new IllegalArgumentException("resource and interval must be valid");
        }
        if (nextId > Integer.MAX_VALUE) { throw new IllegalStateException("ID space exhausted"); }
        Slot candidate = new Slot((int) nextId, resource, start, end);
        for (Slot previous : store.snapshot()) {
            if (overlaps(candidate, previous)) { throw new ConflictException(); }
        }
        store.insert(candidate); nextId++; checkRep(); return candidate.id;
    }
    public List<Slot> list() {
        List<Slot> result = new ArrayList<>(store.snapshot());
        result.sort(Comparator.comparing((Slot s) -> s.resource).thenComparingInt(s -> s.start)
                .thenComparingInt(s -> s.end).thenComparingInt(s -> s.id));
        return result;
    }
    /** v1 contract retained: missing ID is observable failure. */
    public void cancel(int id) {
        if (!store.remove(id)) { throw new NoSuchElementException("unknown ID"); }
        checkRep();
    }
    /** v1.1 new entry: repeat cancellation is safe. It does not change cancel(). */
    public boolean cancelIfPresent(int id) { boolean removed = store.remove(id); checkRep(); return removed; }
    void checkRep() {
        if (nextId < 1 || nextId > (long) Integer.MAX_VALUE + 1) {
            throw new AssertionError("invalid allocation marker");
        }
        List<Slot> all = store.snapshot();
        for (int i = 0; i < all.size(); i++) {
            Slot a = all.get(i);
            if (a == null || a.id <= 0 || a.id >= nextId || a.resource == null
                    || !a.resource.matches("[A-Za-z0-9_-]+") || a.start < 0 || a.start >= a.end) {
                throw new AssertionError("invalid representation");
            }
            for (int j = 0; j < i; j++) {
                Slot b = all.get(j);
                if (a.id == b.id || new OverlapRule().overlaps(a, b)) {
                    throw new AssertionError("duplicate ID or overlapping representation");
                }
            }
        }
    }
}

/** Checked-in pre-refactor implementation: exact expression later extracted. */
final class InlineBook extends BaseBook {
    InlineBook(Store store) { super(store); }
    protected boolean overlaps(Slot a, Slot b) {
        return a.resource.equals(b.resource) && a.start < b.end && b.start < a.end;
    }
}
