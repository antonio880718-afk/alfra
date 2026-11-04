with open('scripts/part_jsx.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Total lines in part_jsx.txt:', len(lines))
for i in range(len(lines) - 70, len(lines)):
    print(f'{i+1}: {lines[i]}', end='')