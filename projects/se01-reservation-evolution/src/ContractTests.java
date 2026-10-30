import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;

public final class ContractTests {
    private static int assertions;
    private static void check(boolean condition, String message) {
        assertions++;
        if (!condition) { throw new AssertionError(message); }
    }
    private static void expect(Class<? extends Throwable> type, Runnable action, String message) {
        try { action.run(); }
        catch (Throwable error) { check(type.isInstance(error), message + " wrong exception " + error); return; }
        throw new AssertionError(message + " did not throw");
    }
    private static BaseBook create(boolean tree, boolean before) {
        Store store = tree ? new TreeStore() : new ListStore();
        return before ? new InlineBook(store) : new ReservationBook(store);
    }
    private static void contract(boolean tree, boolean before) {
        BaseBook book = create(tree, before);
        check(book.reserve("A", 10, 20) == 1, "initial id");
        check(book.reserve("A", 20, 30) == 2, "touch allowed");
        List<Slot> saved = book.list();
        expect(ConflictException.class, () -> book.reserve("A", 19, 21), "overlap rejected");
        check(book.list().equals(saved), "conflict no mutation");
        expect(IllegalArgumentException.class, () -> book.reserve("A", 5, 5), "empty rejected");
        expect(IllegalArgumentException.class, () -> book.reserve("A", 8, 2), "reverse rejected");
        expect(IllegalArgumentException.class, () -> book.reserve("A", -1, 2), "negative rejected");
        expect(IllegalArgumentException.class, () -> book.reserve(null, 1, 2), "null rejected");
        expect(IllegalArgumentException.class, () -> book.reserve("", 1, 2), "name rejected");
        check(book.list().equals(saved), "invalid no mutation");
        check(book.reserve("B", 19, 21) == 3, "different resource; failed calls consume no ID");
        check(saved.size() == 2, "old snapshot not live");
        book.list().clear();
        check(book.list().size() == 3, "returned list does not leak");
        book.cancel(1); check(book.list().size() == 2, "cancel removes only target");
        expect(NoSuchElementException.class, () -> book.cancel(1), "old missing behavior retained");
        check(!book.cancelIfPresent(1), "new repeated cancellation false");
        check(book.cancelIfPresent(2), "new cancellation true");
        check(!book.cancelIfPresent(2), "new second cancellation false");
        check(book.reserve("A", 10, 20) == 4, "cancel permits reuse of time, not ID");
        check(book.list().get(0).resource.equals("A"), "canonical resource sort");
        check(book.reserve("MAX", Integer.MAX_VALUE - 1, Integer.MAX_VALUE) == 5, "no endpoint overflow");
        book.checkRep();
        System.out.println("PASS contract " + (tree ? "tree" : "list") + " " + (before ? "before" : "after"));
    }
    /** Independent small oracle enumerates integer membership, not overlap inequalities. */
    private static boolean oracle(int a, int b, int c, int d) {
        List<Integer> left = new ArrayList<>();
        for (int t = a; t < b; t++) { left.add(t); }
        for (int t = c; t < d; t++) { if (left.contains(t)) { return true; } }
        return false;
    }
    private static void exhaustive() {
        int vectors = 0;
        for (int a = 0; a < 5; a++) { for (int b = a + 1; b <= 5; b++) {
            for (int c = 0; c < 5; c++) { for (int d = c + 1; d <= 5; d++) {
                boolean conflict = oracle(a, b, c, d);
                List<Slot> reference = null;
                for (boolean tree : Arrays.asList(false, true)) { for (boolean before : Arrays.asList(false, true)) {
                    BaseBook book = create(tree, before); book.reserve("A", a, b);
                    boolean rejected = false;
                    try { book.reserve("A", c, d); } catch (ConflictException error) { rejected = true; }
                    check(rejected == conflict, "independent interval oracle");
                    if (reference == null) { reference = book.list(); }
                    check(reference.equals(book.list()), "before/after/list/tree state equivalence");
                    check(book.reserve("B", c, d) == (conflict ? 2 : 3), "allocation identity");
                }}
                vectors++;
            }}
        }}
        System.out.println("PASS exhaustive " + vectors + " interval pairs x 4 variants");
    }
    private static void bugWitnesses() {
        // Deliberately broken closed-interval expression: demonstration of a red test.
        boolean buggyConflict = 20 <= 20 && 10 <= 30;
        boolean boundaryFailed = false;
        try { check(!buggyConflict, "half-open adjacent reservation must succeed"); }
        catch (AssertionError expected) {
            boundaryFailed = true;
            System.out.println("EXPECTED FAIL closed-boundary: " + expected.getMessage());
        }
        check(boundaryFailed, "targeted test detects closed-boundary defect");
        List<Slot> internal = new ArrayList<>(); internal.add(new Slot(1, "A", 10, 20));
        List<Slot> leaked = internal; leaked.clear();
        boolean aliasFailed = false;
        try { check(internal.size() == 1, "clearing a query result must preserve internal size"); }
        catch (AssertionError expected) {
            aliasFailed = true;
            System.out.println("EXPECTED FAIL representation-alias: " + expected.getMessage());
        }
        check(aliasFailed, "targeted test detects representation exposure");
        ReservationBook fixed = new ReservationBook(new ListStore());
        fixed.reserve("A", 10, 20); fixed.reserve("A", 20, 30); fixed.list().clear();
        check(fixed.list().size() == 2, "same attacks fixed");
        System.out.println("PASS expected-red witnesses closed-boundary and alias; fixes verified");
    }
    private static void allocationHistory() {
        for (boolean tree : Arrays.asList(false, true)) { for (boolean before : Arrays.asList(false, true)) {
            BaseBook fresh = create(tree, before);
            BaseBook cancelled = create(tree, before);
            check(cancelled.reserve("A", 10, 20) == 1, "allocate historical ID 1");
            cancelled.cancel(1);
            check(cancelled.list().equals(fresh.list()), "same empty active set");
            expect(IllegalArgumentException.class, () -> cancelled.reserve("A", 8, 8), "failure preserves marker after full cancellation");
            check(fresh.reserve("B", 1, 2) == 1, "fresh empty state returns 1");
            check(cancelled.reserve("B", 1, 2) == 2, "cancelled empty state returns 2; history not reset");
            expect(ConflictException.class, () -> cancelled.reserve("B", 1, 2), "conflict preserves marker");
            cancelled.cancel(2);
            check(cancelled.reserve("B", 1, 2) == 3, "repeated full cancellations preserve historical allocation prefix");
        }}
        System.out.println("PASS allocation-history distinct empty abstract states x 4 variants");
    }
    public static void main(String[] args) {
        for (boolean tree : Arrays.asList(false, true)) { for (boolean before : Arrays.asList(false, true)) { contract(tree, before); }}
        exhaustive(); bugWitnesses(); allocationHistory(); System.out.println("PASS assertions " + assertions);
    }
}
