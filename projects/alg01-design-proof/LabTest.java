import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class LabTest {
    static long assertions = 0;
    static void check(boolean ok, String label) {
        assertions++;
        if (!ok) throw new AssertionError(label);
    }
    static int power(int a, int n) { int x = 1; for (int i = 0; i < n; i++) x *= a; return x; }
    static long inversions() {
        long cases = 0;
        for (int n = 0; n <= 7; n++) for (int code = 0; code < power(3, n); code++) {
            int[] a = new int[n]; int t = code;
            for (int i = 0; i < n; i++) { a[i] = t % 3 - 1; t /= 3; }
            int[] before = a.clone(), expected = a.clone(); Arrays.sort(expected);
            long got = Algorithms.inversions(a);
            check(got == BruteOracle.inversions(before), "inversion count " + Arrays.toString(before));
            check(Arrays.equals(a, expected), "inversion sorted postcondition"); cases++;
        }
        return cases;
    }
    static long knapsacks() {
        long cases = 0;
        for (int n = 0; n <= 3; n++) for (int code = 0; code < power(12, n); code++) {
            int[] w = new int[n], v = new int[n]; int t = code;
            for (int i = 0; i < n; i++) { int x = t % 12; t /= 12; w[i] = x % 3 + 1; v[i] = x / 3; }
            for (int cap = 0; cap <= 7; cap++) {
                Algorithms.Knapsack result = Algorithms.knapsack(w, v, cap);
                check(result.value == BruteOracle.knapsack(w, v, cap), "knapsack optimum");
                int totalWeight = 0, totalValue = 0, mask = 0;
                for (int i : result.items) {
                    check((mask & (1 << i)) == 0, "item reused"); mask |= 1 << i;
                    totalWeight += w[i]; totalValue += v[i];
                }
                check(totalWeight <= cap && totalValue == result.value, "knapsack recovery"); cases++;
            }
        }
        return cases;
    }
    static List<String> words() {
        List<String> a = new ArrayList<String>();
        for (int n = 0; n <= 4; n++) for (int mask = 0; mask < (1 << n); mask++) {
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < n; i++) { if ((mask & (1 << i)) == 0) s.append('A'); else s.append('B'); }
            a.add(s.toString());
        }
        return a;
    }
    static long sequences() {
        long cases = 0;
        for (String a : words()) for (String b : words()) {
            String got = Algorithms.lcs(a, b);
            check(BruteOracle.subsequence(got, a) && BruteOracle.subsequence(got, b), "LCS feasibility");
            check(got.length() == BruteOracle.lcs(a, b), "LCS optimality"); cases++;
        }
        return cases;
    }
    static long flows() {
        long cases = 0;
        // All directed 4-vertex graphs, no loops, capacities 0 or 1; includes antiparallel edges.
        for (int code = 0; code < (1 << 12); code++) {
            int[][] cap = new int[4][4]; int bit = 0;
            for (int u = 0; u < 4; u++) for (int v = 0; v < 4; v++) if (u != v) cap[u][v] = (code >> bit++) & 1;
            Algorithms.Flow got = Algorithms.maxFlow(cap, 0, 3);
            check(got.value == BruteOracle.minCut(cap, 0, 3), "max flow vs enumerated cut");
            check(got.sourceSide[0] && !got.sourceSide[3], "cut sides");
            int cut = 0;
            for (int u = 0; u < 4; u++) for (int v = 0; v < 4; v++) if (got.sourceSide[u] && !got.sourceSide[v]) cut += cap[u][v];
            check(cut == got.value, "returned optimality certificate"); cases++;
        }
        return cases;
    }
    static long matchings() {
        for (int mask = 0; mask < 512; mask++) {
            boolean[][] e = new boolean[3][3];
            for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) e[i][j] = (mask & (1 << (3 * i + j))) != 0;
            check(Algorithms.bipartiteByFlow(e) == BruteOracle.matching(e), "matching reduction");
        }
        return 512;
    }
    static long covers() {
        int[][] allEdges = {{0,1},{0,2},{0,3},{1,2},{1,3},{2,3}};
        for (int graph = 0; graph < 64; graph++) {
            List<int[]> list = new ArrayList<int[]>();
            for (int i = 0; i < 6; i++) if ((graph & (1 << i)) != 0) list.add(allEdges[i]);
            int[][] edges = list.toArray(new int[list.size()][]);
            for (int set = 0; set < 16; set++) check(BruteOracle.independent(set, edges) == BruteOracle.cover(15 ^ set, edges), "IS iff complementary cover");
            int selected = Algorithms.approximateCover(4, edges);
            check(BruteOracle.cover(selected, edges), "approximate cover feasible");
            check(Integer.bitCount(selected) <= 2 * BruteOracle.minCover(4, edges), "2-approx bound");
        }
        return 64;
    }
    static long intervals() {
        int[][] all = {{0,1,1},{0,2,1},{1,2,1},{1,3,1},{2,3,1},{0,3,1}};
        for (int mask = 0; mask < 64; mask++) {
            List<int[]> l = new ArrayList<int[]>();
            for (int i = 0; i < all.length; i++) if ((mask & (1 << i)) != 0) l.add(all[i]);
            int[][] a = l.toArray(new int[l.size()][]);
            check(Algorithms.earliestFinishWeight(a) == BruteOracle.intervals(a), "unweighted greedy");
            check(Algorithms.weightedIntervals(a) == BruteOracle.intervals(a), "interval DP");
        }
        // Exhaust all weights 0..2 on this fixed interval universe.
        for (int code = 0; code < 729; code++) {
            int t = code; int[][] a = new int[6][3];
            for (int i = 0; i < 6; i++) { a[i] = all[i].clone(); a[i][2] = t % 3; t /= 3; }
            check(Algorithms.weightedIntervals(a) == BruteOracle.intervals(a), "weighted interval DP");
        }
        return 793;
    }
    public static void main(String[] args) {
        long inv = inversions(), ks = knapsacks(), seq = sequences(), flow = flows(), match = matchings(), cover = covers(), interval = intervals();
        int[] w = {2,3,4}, v = {4,5,7};
        int[][] weighted = {{0,2,2},{2,4,2},{0,4,5}};
        int[][] cap = {{0,2,1,0},{0,0,1,1},{0,0,0,2},{0,0,0,0}};
        Algorithms.Flow fixedFlow = Algorithms.maxFlow(cap, 0, 3);
        long fixedInversions = Algorithms.inversions(new int[]{3,1,2});
        check(fixedInversions == 2, "ALG-T1");
        check(Algorithms.knapsack(w, v, 4).value == 7, "ALG-T2");
        check(Algorithms.wrongForwardKnapsack(w, v, 4) == 8, "counterexample exposes wrong direction");
        check(Algorithms.earliestFinishWeight(weighted) == 4 && BruteOracle.intervals(weighted) == 5, "ALG-T3");
        String lcs = Algorithms.lcs("ABCD", "ACBD");
        check(lcs.length() == 3 && BruteOracle.subsequence(lcs, "ABCD") && BruteOracle.subsequence(lcs, "ACBD"), "ALG-T4");
        check(fixedFlow.value == 3 && fixedFlow.trace.size() == 3, "flow fixed trace");
        System.out.println("{\"inversions\":" + fixedInversions + ",\"knapsack\":" + Algorithms.knapsack(w,v,4).value + ",\"wrongKnapsack\":" + Algorithms.wrongForwardKnapsack(w,v,4) + ",\"greedyWeight\":" + Algorithms.earliestFinishWeight(weighted) + ",\"optimalWeight\":" + Algorithms.weightedIntervals(weighted) + ",\"lcsLength\":" + lcs.length() + ",\"lcs\":\"" + lcs + "\",\"flow\":" + fixedFlow.value + ",\"cases\":{\"inversions\":" + inv + ",\"knapsack\":" + ks + ",\"lcs\":" + seq + ",\"flow\":" + flow + ",\"matching\":" + match + ",\"cover\":" + cover + ",\"intervals\":" + interval + "},\"assertions\":" + assertions + "}");
        for (String line : fixedFlow.trace) System.err.println(line);
    }
}
