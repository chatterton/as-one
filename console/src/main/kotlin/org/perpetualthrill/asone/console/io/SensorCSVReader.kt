package org.perpetualthrill.asone.console.io

import java.sql.ResultSet.CONCUR_READ_ONLY
import java.sql.ResultSet.TYPE_SCROLL_INSENSITIVE
import javax.inject.Inject
import javax.inject.Singleton
import java.util.Vector
import java.io.InputStreamReader
import org.xbib.jdbc.io.TableReader
import java.io.Reader
import java.net.HttpURLConnection
import java.net.URL
import java.sql.*


@Singleton
class SensorCSVReader
@Inject
constructor() {

    private val connection: Connection

    init {
     //   Class.forName("org.relique.jdbc.csv.CsvDriver")
        connection = DriverManager.getConnection("jdbc:xbib:csv:class:"+ResourceFileReader::class.java.name)
    }

    fun getQuiescentResults(): ResultIterator {
        val statement = connection.createStatement(TYPE_SCROLL_INSENSITIVE, CONCUR_READ_ONLY)
        val resultSet = statement.executeQuery("select s1, s2, s3, s4, state from log-data-20190512 where state = 'quiescent'")
        return ResultIterator(resultSet, false)
    }

    fun finish() {
        connection.close()
    }

    data class CSVReading(
        val s1: Int,
        val s2: Int,
        val s3: Int,
        val s4: Int
    )

    // Note! This class does a lot of real borderline shit. Check hasNext before calling getNext
    // on a one shot result set or it will throw
    class ResultIterator(private val resultSet: ResultSet, private val oneShot: Boolean) {
        val hasNext = {
            if (oneShot) {
                !resultSet.isAfterLast
            } else true
        }

        fun getNext(): CSVReading {
            val gotNext = resultSet.next()
            if (!gotNext && !oneShot) {
                resultSet.first()
            }
            return csvReadingFromCurrentRow()
        }

        private fun csvReadingFromCurrentRow(): CSVReading {
            return CSVReading(resultSet.getInt(1), resultSet.getInt(2), resultSet.getInt(3), resultSet.getInt(4))
        }
    }

    class ResourceFileReader : TableReader {
        override fun getReader(statement: Statement, tableName: String): Reader {
            val inputStream = javaClass.getResourceAsStream("/$tableName.csv")
            return InputStreamReader(inputStream)
        }

        override fun getTableNames(connection: Connection): List<String> {
            val v = Vector<String>()
            v.add("log-data-20190512")
            return v
        }
    }

}