/** Independent slow references: enumeration, not copies of the optimized recurrences. */
public final class BruteOracle {
    private BruteOracle() { }
    public static long inversions(int[] a) {
        long total = 0;
        for (int i = 0; i < a.length; i++) for (int j = i + 1; j < a.length; j++) if (a[i] > a[j]) total++;
        return total;
    }
    public static int knapsack(int[] w, int[] v, int cap) {
        int best = 0;
        for (int mask = 0; mask < (1 << w.length); mask++) {
            int weight = 0, value = 0;
            for (int i = 0; i < w.length; i++) if ((mask & (1 << i)) != 0) { weight += w[i]; value += v[i]; }
            if (weight <= cap) best = Math.max(best, value);
        }
        return best;
    }
    public static boolean subsequence(String small, String large) {
        int i = 0;
        for (int j = 0; j < large.length() && i < small.length(); j++) if (small.charAt(i) == large.charAt(j)) i++;
        return i == small.length();
    }
    public static int lcs(String a, String b) {
        int best = 0;
        for (int mask = 0; mask < (1 << a.length()); mask++) {
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < a.length(); i++) if ((mask & (1 << i)) != 0) s.append(a.charAt(i));
            if (subsequence(s.toString(), b)) best = Math.max(best, s.length());
        }
        return best;
    }
    public static int intervals(int[][] a) {
        int best = 0;
        for (int mask = 0; mask < (1 << a.length); mask++) {
            boolean valid = true; int value = 0;
            for (int i = 0; i < a.length; i++) if ((mask & (1 << i)) != 0) {
                value += a[i][2];
                for (int j = i + 1; j < a.length; j++) if ((mask & (1 << j)) != 0) {
                    if (a[i][0] < a[j][1] && a[j][0] < a[i][1]) valid = false;
                }
            }
            if (valid) best = Math.max(best, value);
        }
        return best;
    }
    public static int minCut(int[][] capacity, int s, int t) {
        int best = Integer.MAX_VALUE, n = capacity.length;
        for (int mask = 0; mask < (1 << n); mask++) {
            if ((mask & (1 << s)) == 0 || (mask & (1 << t)) != 0) continue;
            int cut = 0;
            for (int u = 0; u < n; u++) if ((mask & (1 << u)) != 0) {
                for (int v = 0; v < n; v++) if ((mask & (1 << v)) == 0) cut += capacity[u][v];
            }
            best = Math.min(best, cut);
        }
        return best;
    }
    public static int matching(boolean[][] e) { return matchingAt(e, 0, 0); }
    private static int matchingAt(boolean[][] e, int left, int usedRight) {
        if (left == e.length) return 0;
        int best = matchingAt(e, left + 1, usedRight);
        for (int j = 0; j < e[left].length; j++) if (e[left][j] && (usedRight & (1 << j)) == 0) {
            best = Math.max(best, 1 + matchingAt(e, left + 1, usedRight | (1 << j)));
        }
        return best;
    }
    public static boolean cover(int mask, int[][] edges) {
        for (int[] e : edges) if ((mask & ((1 << e[0]) | (1 << e[1]))) == 0) return false;
        return true;
    }
    public static boolean independent(int mask, int[][] edges) {
        for (int[] e : edges) if ((mask & (1 << e[0])) != 0 && (mask & (1 << e[1])) != 0) return false;
        return true;
    }
    public static int minCover(int n, int[][] edges) {
        int best = n;
        for (int mask = 0; mask < (1 << n); mask++) if (cover(mask, edges)) best = Math.min(best, Integer.bitCount(mask));
        return best;
    }
}
