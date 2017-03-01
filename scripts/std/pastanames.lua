--[[

  This module provides the following functionality:
    - #pastaname <cn>: rename players to a delicious variety of pasta, with a custom prefix to distinguish the renamed
    - auto-pastaname: change unnamed player's name to a pasta-variety upon connect (occasionally makes the command redundant)
    - no_unnaming: any name change to "unnamed" will not be visible to other players

  Ideas by a_theory and Star
  Implementation by Mr.Benz
  
]]--

local commands, playermsg, putf, client = require"std.commands", require"std.playermsg", require"std.putf", require"std.n_client"

local autopasta = true  	-- enable auto-renaming?
local use_prefix = true 	-- use name prefix?
local prefix = "(&)"		-- this must not be longer than 3 chars, else some pasta has to be removed D:


-- Fritz_Fokker's impressive list of pastanames
local PastaNames = {
	"Anelli"
	,"Barbina"
	,"Fettucine"
	,"Agnolotti"
	,"Alfabeto"
	,"Anelli"
	,"Anellini"
	,"Barbina"
	,"Bavette"
	,"Bavettine"
	,"Bucatini"
	,"Calamarata"
	,"Calamaretti"
	,"Cannelloni"
	,"Capellini"
	,"Capunti"
	,"Casarecce"
	,"Casunziei"
	,"Cavatappi"
	,"Cavatelli"
	,"Cellentani"
	,"Cencioni"
	,"Chifferi"
	,"Ciriole"
	,"Conchiglie"
	,"Conchiglioni"
	,"Corallini"
	,"Corzetti"
	,"Couscous"
	,"Croxetti"
	,"Ditali"
	,"Ditalini"
	,"Egg_barley"
	,"Elicoidali"
	,"Fagioloni"
	,"Fagottini"
	,"Farfalle"
	,"Farfalline"
	,"Farfalloni"
	,"Fedelini"
	,"Fettuccine"
	,"Fettuce"
	,"Fideos"
	,"Filini"
	,"Fiorentine"
	,"Fiori"
	,"Fregula"
	,"Funghini"
	,"Fusilli"
	,"Garganelli"
	,"Gemelli"
	,"Gigli"
	,"Gnocchi"
	,"Gomito"
	,"Gramigna"
	,"Lagane"
	,"Lanterne"
	,"Lasagne"
	,"Lasagnette"
	,"Linguettine"
	,"Linguine"
	,"Lumache"
	,"Lumaconi"
	,"Mafalde"
	,"Mafaldine"
	,"Maltagliati"
	,"Mandala"
	,"Manicotti"
	,"Marille"
	,"Marziani"
	,"Maultasche"
	,"Mezzelune"
	,"Mostaccioli"
	,"Orecchiette"
	,"Paccheri"
	,"Pappardelle"
	,"Passatelli"
	,"Pastina"
	,"Pelmeni"
	,"Penne"
	,"Penne_lisce"
	,"Penne_rigate"
	,"Penne_zita"
	,"Pennette"
	,"Pennoni"
	,"Perciatelli"
	,"Pici"
	,"Pierogi"
	,"Pillus"
	,"Pipe"
	,"Pizzoccheri"
	,"Ptitim"
	,"Quadrefiore"
	,"Quadrettini"
	,"Radiatori"
	,"Ravioli"
	,"Ricciolni"
	,"Ricciutelle"
	,"Rigatoncini"
	,"Rigatoni"
	,"Risi"
	,"Rotelle"
	,"Rotini"
	,"Sacchettini"
	,"Sagnarelli"
	,"Scialatelli"
	,"Spaghettini"
	,"Spaghettoni"
	,"Spirali"
	,"Stelle"
	,"Stelline"
	,"Stortini"
	,"Stringozzi"
	,"Strozzapreti"
	,"Tagliatelle"
	,"Taglierini"
	,"Tarhana"
	,"Torchio"
	,"Tortellini"
	,"Tortelloni"
	,"Tortiglioni"
	,"Trenette"
	,"Trenne"
	,"Trennette"
	,"Tripoline"
	,"Trofie"
	,"Vermicelli"
	,"Vermicelloni"
	,"Ziti"
	,"Zitoni"	
}

commands.add("pastaname", function(info)

  if info.ci.privilege < server.PRIV_MASTER then return playermsg("Insufficient privilege.", info.ci) end
  if not info.args then return playermsg("You did not enter a valid cn.", info.ci) end
  local cn = tonumber(info.args)
  if not cn then return playermsg("You did not enter a valid cn.", info.ci) end

  local who = engine.getclientinfo(cn)
  if not who then playermsg("Cannot find cn " .. cn .. ".", info.ci) return end

  local randomname = PastaNames[math.random(#PastaNames)]
  local newname = use_prefix and prefix .. randomname or randomname  
  local oldname = who.name

  who.messages:putint(server.N_SWITCHNAME)
  who.messages:sendstring(newname)
  engine.sendpacket(who.clientnum, 1, client(putf({newname:len(), r = 1}, server.N_SWITCHNAME, newname), who):finalize(), -1)
  
  who.name = newname
  engine.writelog(("renamed %s (%d) into %s from %s (pastaname)"):format(oldname, cn, who.name, info.ci.name))

end, "#pastaname <cn>: change the name of player <cn> to a delicious variety of pasta.")

spaghetti.addhook("connected", function(info)

  local who = info.ci
  if not who then return end

  local randomname = PastaNames[math.random(#PastaNames)]
  local newname = use_prefix and prefix .. randomname or randomname
  local oldname = who.name
  
  if who.name == "unnamed" and autopasta then
    who.messages:putint(server.N_SWITCHNAME)
    who.messages:sendstring(newname)
    engine.sendpacket(who.clientnum, 1, client(putf({newname:len(), r = 1}, server.N_SWITCHNAME, newname), who):finalize(), -1)

    who.name = newname
    engine.writelog(("renamed %s (%d) into %s automatically (pastaname)"):format(oldname, who.clientnum, who.name))
  end

end)

local function no_unnaming(info)
  if info.text == "unnamed" then 
    info.skip = true 
  end
end

spaghetti.addhook(server.N_SWITCHNAME, no_unnaming)
