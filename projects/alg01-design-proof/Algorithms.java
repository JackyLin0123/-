import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/** Teaching implementations. All public input sizes are deliberately bounded by the runner. */
public final class Algorithms {
    private Algorithms() { }

    // Postcondition: a is sorted; return the inversion count of the original values.
    public static long inversions(int[] a) {
        return mergeCount(a, new int[a.length], 0, a.length);
    }
    private static long mergeCount(int[] a, int[] tmp, int l, int r) {
        if (r - l < 2) return 0;
        int m = l + (r - l) / 2;
        long count = mergeCount(a, tmp, l, m) + mergeCount(a, tmp, m, r);
        int i = l, j = m, k = l;
        while (i < m && j < r) {
            if (a[i] <= a[j]) tmp[k++] = a[i++];
            else {
                count += m - i;
                tmp[k++] = a[j++];
            }
        }
        while (i < m) tmp[k++] = a[i++];
        while (j < r) tmp[k++] = a[j++];
        for (int p = l; p < r; p++) a[p] = tmp[p];
        return count;
    }

    // Each row: start, exclusive end, nonnegative weight.
    public static int earliestFinishWeight(int[][] intervals) {
        int[][] a = sortedIntervals(intervals);
        int last = Integer.MIN_VALUE, total = 0;
        for (int[] x : a) {
            if (x[0] >= last) {
                total += x[2];
                last = x[1];
            }
        }
        return total;
    }
    public static int weightedIntervals(int[][] intervals) {
        int[][] a = sortedIntervals(intervals);
        int[] best = new int[a.length + 1];
        for (int i = 1; i <= a.length; i++) {
            int p = i - 1;
            while (p > 0 && a[p - 1][1] > a[i - 1][0]) p--;
            best[i] = Math.max(best[i - 1], a[i - 1][2] + best[p]);
        }
        return best[a.length];
    }
    private static int[][] sortedIntervals(int[][] input) {
        int[][] a = new int[input.length][];
        for (int i = 0; i < a.length; i++) a[i] = input[i].clone();
        Arrays.sort(a, new Comparator<int[]>() {
            @Override public int compare(int[] x, int[] y) {
                int endOrder = Integer.compare(x[1], y[1]);
                if (endOrder != 0) return endOrder;
                return Integer.compare(x[0], y[0]);
            }
        });
        return a;
    }

    public static final class Knapsack {
        public final int value;
        public final int[] items;
        public final int[][] table;
        Knapsack(int value, int[] items, int[][] table) {
            this.value = value; this.items = items; this.table = table;
        }
    }
    public static Knapsack knapsack(int[] w, int[] v, int capacity) {
        int[][] f = new int[w.length + 1][capacity + 1];
        for (int i = 1; i <= w.length; i++) {
            for (int c = 0; c <= capacity; c++) {
                f[i][c] = f[i - 1][c];
                if (c >= w[i - 1]) {
                    f[i][c] = Math.max(f[i][c], v[i - 1] + f[i - 1][c - w[i - 1]]);
                }
            }
        }
        List<Integer> chosen = new ArrayList<Integer>();
        int c = capacity;
        for (int i = w.length; i > 0; i--) {
            if (f[i][c] != f[i - 1][c]) {
                chosen.add(i - 1);
                c -= w[i - 1];
            }
        }
        int[] items = new int[chosen.size()];
        for (int i = 0; i < items.length; i++) items[i] = chosen.get(items.length - 1 - i);
        return new Knapsack(f[w.length][capacity], items, f);
    }
    // Deliberately wrong for 0/1; retained solely as a counterexample.
    public static int wrongForwardKnapsack(int[] w, int[] v, int capacity) {
        int[] f = new int[capacity + 1];
        for (int i = 0; i < w.length; i++) {
            for (int c = w[i]; c <= capacity; c++) f[c] = Math.max(f[c], v[i] + f[c - w[i]]);
        }
        return f[capacity];
    }

    public static String lcs(String a, String b) {
        int[][] f = new int[a.length() + 1][b.length() + 1];
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1)) f[i][j] = f[i - 1][j - 1] + 1;
                else f[i][j] = Math.max(f[i - 1][j], f[i][j - 1]);
            }
        }
        StringBuilder answer = new StringBuilder();
        int i = a.length(), j = b.length();
        while (i > 0 && j > 0) {
            if (a.charAt(i - 1) == b.charAt(j - 1)) {
                answer.append(a.charAt(i - 1)); i--; j--;
            } else if (f[i - 1][j] >= f[i][j - 1]) i--;
            else j--;
        }
        return answer.reverse().toString();
    }

    public static final class Flow {
        public final int value;
        public final boolean[] sourceSide;
        public final List<String> trace;
        Flow(int value, boolean[] side, List<String> trace) {
            this.value = value; this.sourceSide = side; this.trace = trace;
        }
    }
    // Dense residual matrix supports antiparallel capacities by aggregation.
    // O(V^2) per BFS in this implementation; the standard adjacency-list bound is separate.
    public static Flow maxFlow(int[][] capacity, int source, int sink) {
        int n = capacity.length, value = 0;
        int[][] residual = new int[n][n];
        for (int i = 0; i < n; i++) residual[i] = capacity[i].clone();
        List<String> trace = new ArrayList<String>();
        boolean[] side;
        while (true) {
            int[] parent = new int[n]; Arrays.fill(parent, -1); parent[source] = source;
            ArrayDeque<Integer> queue = new ArrayDeque<Integer>(); queue.add(source);
            while (!queue.isEmpty()) {
                int u = queue.remove();
                for (int v = 0; v < n; v++) {
                    if (parent[v] == -1 && residual[u][v] > 0) { parent[v] = u; queue.add(v); }
                }
            }
            if (parent[sink] == -1) {
                side = new boolean[n];
                for (int i = 0; i < n; i++) side[i] = parent[i] != -1;
                break;
            }
            int delta = Integer.MAX_VALUE;
            for (int v = sink; v != source; v = parent[v]) delta = Math.min(delta, residual[parent[v]][v]);
            String path = Integer.toString(sink);
            for (int v = sink; v != source; v = parent[v]) {
                int u = parent[v]; residual[u][v] -= delta; residual[v][u] += delta;
                path = u + "->" + path;
            }
            value += delta; trace.add(path + ":+" + delta + ",total=" + value);
        }
        return new Flow(value, side, trace);
    }
    public static int bipartiteByFlow(boolean[][] edges) {
        int left = edges.length, right = edges[0].length;
        int sink = left + right + 1;
        int[][] cap = new int[sink + 1][sink + 1];
        for (int i = 0; i < left; i++) {
            cap[0][i + 1] = 1;
            for (int j = 0; j < right; j++) if (edges[i][j]) cap[i + 1][left + 1 + j] = 1;
        }
        for (int j = 0; j < right; j++) cap[left + 1 + j][sink] = 1;
        return maxFlow(cap, 0, sink).value;
    }
    public static int approximateCover(int n, int[][] edges) {
        int selected = 0;
        for (int[] e : edges) {
            int ends = (1 << e[0]) | (1 << e[1]);
            if ((selected & ends) == 0) selected |= ends;
        }
        return selected;
    }
}
