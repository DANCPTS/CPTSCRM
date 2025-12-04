'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, FileText, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';

interface SearchResult {
  id: string;
  type: 'candidate' | 'company' | 'lead';
  title: string;
  subtitle: string;
  metadata?: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const searchAll = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const searchResults: SearchResult[] = [];

      try {
        const searchTerms = searchQuery.toLowerCase().split(' ').filter(t => t.length > 0);

        const { data: candidatesData, error: candidatesError } = await supabase
          .from('candidates')
          .select('id, first_name, last_name, email, phone');

        if (candidatesError) {
          console.error('Candidates search error:', candidatesError);
        }

        const matchedCandidates = candidatesData?.map(candidate => {
          const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.toLowerCase().trim();
          const email = candidate.email?.toLowerCase() || '';
          const phone = candidate.phone?.toLowerCase() || '';

          let score = 0;
          let matches = true;

          for (const term of searchTerms) {
            if (fullName.includes(term)) {
              score += 10; // High priority for name matches
            } else if (email.includes(term)) {
              score += 2; // Lower priority for email
            } else if (phone.includes(term)) {
              score += 2; // Lower priority for phone
            } else {
              matches = false;
              break;
            }
          }

          return matches ? { ...candidate, score, fullName } : null;
        }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => b.score - a.score).slice(0, 5) || [];

        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name, address, postcode');

        const matchedCompanies = companiesData?.map(company => {
          const name = company.name?.toLowerCase() || '';
          const address = company.address?.toLowerCase() || '';
          const postcode = company.postcode?.toLowerCase() || '';

          let score = 0;
          let matches = true;

          for (const term of searchTerms) {
            if (name.includes(term)) {
              score += 10; // High priority for name matches
            } else if (address.includes(term)) {
              score += 2; // Lower priority for address
            } else if (postcode.includes(term)) {
              score += 2; // Lower priority for postcode
            } else {
              matches = false;
              break;
            }
          }

          return matches ? { ...company, score } : null;
        }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => b.score - a.score).slice(0, 5) || [];

        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, name, company_name, email, phone');

        const matchedLeads = leadsData?.map(lead => {
          const name = lead.name?.toLowerCase() || '';
          const companyName = lead.company_name?.toLowerCase() || '';
          const email = lead.email?.toLowerCase() || '';
          const phone = lead.phone?.toLowerCase() || '';

          let score = 0;
          let matches = true;

          for (const term of searchTerms) {
            if (name.includes(term)) {
              score += 10; // High priority for name matches
            } else if (companyName.includes(term)) {
              score += 5; // Medium priority for company name
            } else if (email.includes(term)) {
              score += 2; // Lower priority for email
            } else if (phone.includes(term)) {
              score += 2; // Lower priority for phone
            } else {
              matches = false;
              break;
            }
          }

          return matches ? { ...lead, score } : null;
        }).filter((l): l is NonNullable<typeof l> => l !== null).sort((a, b) => b.score - a.score).slice(0, 5) || [];

        matchedCandidates.forEach((candidate) => {
          searchResults.push({
            id: candidate.id,
            type: 'candidate',
            title: `${candidate.first_name} ${candidate.last_name}`,
            subtitle: candidate.email || candidate.phone || 'No contact info',
            metadata: 'Candidate',
          });
        });

        matchedCompanies.forEach((company) => {
          searchResults.push({
            id: company.id,
            type: 'company',
            title: company.name,
            subtitle: company.address || company.postcode || 'No address',
            metadata: 'Company',
          });
        });

        matchedLeads.forEach((lead) => {
          searchResults.push({
            id: lead.id,
            type: 'lead',
            title: lead.name || 'Unnamed Lead',
            subtitle: lead.email || lead.phone || lead.company_name || 'No contact info',
            metadata: 'Lead',
          });
        });

        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchAll, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Clear search when dialog closes
      setSearchQuery('');
      setResults([]);
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setSearchQuery('');
    setResults([]);

    if (result.type === 'candidate') {
      router.push(`/candidates?id=${result.id}`);
    } else if (result.type === 'company') {
      router.push(`/companies?id=${result.id}`);
    } else if (result.type === 'lead') {
      router.push(`/leads?id=${result.id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'candidate':
        return <User className="h-4 w-4" />;
      case 'company':
        return <Building2 className="h-4 w-4" />;
      case 'lead':
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search candidates, companies, leads...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
        <CommandInput
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <>
              {['candidate', 'company', 'lead'].map((type) => {
                const typeResults = results.filter((r) => r.type === type);
                if (typeResults.length === 0) return null;

                return (
                  <CommandGroup
                    key={type}
                    heading={type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                  >
                    {typeResults.map((result) => (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3 w-full">
                          {getIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.subtitle}
                            </p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </>
          ) : searchQuery.length >= 2 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search...
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
