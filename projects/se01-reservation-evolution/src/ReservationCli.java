import java.util.Scanner;

/** Each invocation starts an empty store. No network or persistence. */
public final class ReservationCli {
    public static void main(String[] args) {
        if (args.length > 1 || (args.length == 1 && !args[0].equals("list") && !args[0].equals("tree"))) {
            throw new IllegalArgumentException("store must be list or tree");
        }
        Store store = args.length == 1 && args[0].equals("tree") ? new TreeStore() : new ListStore();
        ReservationBook book = new ReservationBook(store);
        Scanner input = new Scanner(System.in);
        System.out.println("READY reserve RESOURCE START END | list | cancel ID | cancel-if-present ID | quit");
        while (input.hasNextLine()) {
            String line = input.nextLine().trim();
            if (line.isEmpty()) { continue; }
            String[] words = line.split("\\s+");
            try {
                if (words[0].equals("quit") && words.length == 1) { break; }
                if (words[0].equals("reserve") && words.length == 4) {
                    int id = book.reserve(words[1], Integer.parseInt(words[2]), Integer.parseInt(words[3]));
                    System.out.println("OK " + id);
                } else if (words[0].equals("list") && words.length == 1) {
                    System.out.println("LIST " + book.list());
                } else if (words[0].equals("cancel") && words.length == 2) {
                    book.cancel(Integer.parseInt(words[1])); System.out.println("CANCELLED");
                } else if (words[0].equals("cancel-if-present") && words.length == 2) {
                    System.out.println("REMOVED " + book.cancelIfPresent(Integer.parseInt(words[1])));
                } else { System.out.println("ERROR command"); }
            } catch (RuntimeException error) {
                System.out.println("ERROR " + error.getClass().getSimpleName());
            }
        }
        input.close();
    }
}
